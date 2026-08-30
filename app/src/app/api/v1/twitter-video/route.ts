import { type NextRequest, NextResponse } from "next/server";
import { read as prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/rate-limit";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";
import { getAppBaseUrl } from "@/lib/url";

const log = createLogger("api/v1/twitter-video");

const ALLOWED_HOSTS = new Set(["video.twimg.com"]);
const CACHE_CONTROL = "public, max-age=86400, s-maxage=86400, immutable";
// Fallback-path responses are gated on Origin/Referer, which the response's Vary
// (Sec-Fetch-Site only) doesn't key on. `private` would keep them out of CDNs but
// still let the browser cache them — and since both a legit old-browser load and
// a cross-site old-browser embed share the "no Sec-Fetch-Site" variant, that
// browser could replay a cached first-party 200 to the embed without the gate
// running. So make the fallback path uncacheable everywhere.
const CACHE_CONTROL_FALLBACK = "no-store";

// Cap the bytes we'll proxy in a single upstream response. Comfortably covers a
// standard (<=2:20) 1080p tweet video fetched in one open-ended range while
// bounding per-request egress. Only enforceable when upstream declares
// Content-Length (video.twimg.com reliably does); a 206 range response's
// Content-Length is the returned slice, so normal chunked seeking stays well
// under this. The rate limit is the primary volume control.
const MAX_UPSTREAM_BYTES = 150 * 1024 * 1024;

// Bounds an upstream hang. Because we hand the body stream to the client after
// fetch() resolves (headers received), this deadline also covers body streaming
// — a very slow client on the largest capped file could hit it on a single
// open-ended range fetch. Accepted tradeoff: kept generous so legitimate
// streaming of a capped-size file completes; the size cap + rate limit are the
// primary volume controls, not this timer.
const UPSTREAM_TIMEOUT_MS = 120_000;

// A twimg 3xx must never turn this into an open proxy to another host. Follow at
// most this many redirects, re-validating each hop against ALLOWED_HOSTS.
const MAX_REDIRECTS = 3;

const PASSTHROUGH_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
];

// Sec-Fetch-Site values that mark a first-party (same-site) request. Set by the
// browser and unspoofable by page script (a forbidden header name).
const FIRST_PARTY_SEC_FETCH_SITE = new Set(["same-origin", "same-site"]);

/**
 * Gate: only proxy first-party requests.
 *
 * Both consumers render a plain same-origin `<video>` on an abode page (no
 * crossOrigin), so every media load — including Range/seek continuations —
 * carries the browser-set, script-unspoofable `Sec-Fetch-Site: same-origin`,
 * which passes. A `<video>` embed on evil.com sends `Sec-Fetch-Site:
 * cross-site` → blocked. `none` (direct address-bar hit) is not a playback
 * path, so it is blocked too — we won't be a free proxy for direct hits.
 *
 * Browsers predating Sec-Fetch metadata (Safari < 16.4) omit it: fall back to
 * the Origin/Referer origin. With no explicit Referrer-Policy the browser
 * default sends a full Referer on a same-origin subresource, so old-Safari
 * playback still passes. A bare curl/script sends none of these → blocked
 * (though a client that forges these headers is bounded by the rate limit).
 */
function isFirstPartyRequest(request: NextRequest): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite !== null)
    return FIRST_PARTY_SEC_FETCH_SITE.has(secFetchSite);

  const appOrigin = new URL(getAppBaseUrl()).origin;

  const origin = request.headers.get("origin");
  if (origin !== null) return origin === appOrigin;

  const referer = request.headers.get("referer");
  if (referer !== null) {
    try {
      return new URL(referer).origin === appOrigin;
    } catch {
      return false;
    }
  }

  // No Sec-Fetch metadata, no Origin, no Referer → not a browser subresource.
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Collect every stored video-variant `src` from an item's tweet media JSON.
 *
 * The proxy only serves a `url` that appears in this set, so a valid item id
 * can't be used as a free proxy for an arbitrary twimg URL. Walked defensively
 * because `media` is untyped JSON.
 */
function collectItemVideoSrcs(media: unknown): Set<string> {
  const srcs = new Set<string>();
  if (!Array.isArray(media)) return srcs;
  for (const entry of media) {
    if (!isRecord(entry)) continue;
    const { variants } = entry;
    if (!Array.isArray(variants)) continue;
    for (const variant of variants) {
      if (isRecord(variant) && typeof variant.src === "string") {
        srcs.add(variant.src);
      }
    }
  }
  return srcs;
}

type UpstreamOutcome =
  | { ok: true; response: Response }
  | { ok: false; status: number; reason: string };

/**
 * Fetch `initialUrl`, following redirects manually and re-validating every hop
 * against ALLOWED_HOSTS so a twimg 3xx can't escape the allowlist. Shares one
 * AbortSignal across the chain to bound total upstream time.
 */
async function fetchAllowlisted(
  initialUrl: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<UpstreamOutcome> {
  let current = initialUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    // Raw fetch is deliberate: safeFetch caps body size, which would truncate a
    // video, and each hop is re-validated against ALLOWED_HOSTS below. Exempted
    // from the no-raw-fetch plugin by path in biome.json.
    const response = await fetch(current, {
      headers,
      redirect: "manual",
      signal,
    });

    const isRedirect = response.status >= 300 && response.status < 400;
    if (!isRedirect) return { ok: true, response };

    const location = response.headers.get("location");
    // Drain the redirect body so the connection can be reused.
    await response.body?.cancel().catch(() => {});

    if (!location) {
      return { ok: false, status: 502, reason: "redirect without location" };
    }

    let next: URL;
    try {
      next = new URL(location, current);
    } catch {
      return { ok: false, status: 502, reason: "invalid redirect location" };
    }

    if (!ALLOWED_HOSTS.has(next.host) || next.protocol !== "https:") {
      return { ok: false, status: 502, reason: "redirect host not allowed" };
    }

    current = next.toString();
  }

  return { ok: false, status: 502, reason: "too many redirects" };
}

/**
 * Streaming proxy for Twitter video CDN.
 *
 * video.twimg.com returns 403 when the browser sends Referer from our origin.
 * Fetching server-side (no Referer) returns 200, so we pipe the bytes through.
 * Range requests are forwarded so the <video> element can seek without
 * downloading the whole file.
 *
 * The proxy is item-scoped: a caller passes the owning item's id, and we only
 * serve a `url` that is one of that item's stored tweet-media variants and only
 * for an item the caller may access (owner, or the item is in a public room).
 * This means a valid item id can't be turned into a free proxy for an arbitrary
 * twimg URL, and another user's private media can't be fetched. A `<video>`
 * can't send a bearer token and tweet cards render on anonymously-viewable
 * public rooms, so unauthenticated access to public-room items is allowed
 * rather than blanket-401'd. Abuse is further contained by: a same-origin gate,
 * a rate limit, no blind redirect following, a response size cap, and an
 * upstream timeout.
 */
export async function GET(request: NextRequest) {
  // 1. First-party gate (primary control). Reject cross-site embeds and bare
  //    curl/script hits before doing any work or touching the upstream.
  if (!isFirstPartyRequest(request)) {
    return NextResponse.json({ message: "forbidden" }, { status: 403 });
  }

  const itemId = request.nextUrl.searchParams.get("itemId");
  if (!itemId) {
    return NextResponse.json(
      { message: "itemId is required" },
      { status: 400 },
    );
  }

  const target = request.nextUrl.searchParams.get("url");
  if (!target) {
    return NextResponse.json({ message: "url is required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ message: "invalid url" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(parsed.host) || parsed.protocol !== "https:") {
    return NextResponse.json({ message: "host not allowed" }, { status: 400 });
  }

  // 2. Auth (may be anonymous). getUserWithMfa, never raw getUser, so a 2FA
  //    user's AAL1 session can't slip past — see no-raw-cookie-getuser.grit.
  const supabase = await createClient();
  const {
    data: { user },
  } = await getUserWithMfa(supabase);

  // 3. Rate limit (defense-in-depth). Best-effort: in-memory, per instance, and
  //    reset on deploy — the same-origin gate + item scoping + size cap are the
  //    primary controls. Keyed on the user when authenticated, else the IP.
  const rateLimitKey = user?.id ?? getClientIp(request.headers);
  const rateLimit = checkRateLimit(rateLimitKey, "twitterVideo");
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "Too many requests" },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimit, "twitterVideo"),
      },
    );
  }

  // 4. Item scoping. Load the item the caller claims this media belongs to,
  //    access-controlled: owner OR the item is in a public room (mirrors
  //    map-image). Unauthenticated callers only reach public-room items.
  const item = await prisma.item.findFirst({
    where: {
      id: itemId,
      ...(user
        ? {
            OR: [
              { userId: user.id },
              { roomItems: { some: { room: { visibility: "public" } } } },
            ],
          }
        : { roomItems: { some: { room: { visibility: "public" } } } }),
    },
    select: { id: true, twitterDetails: { select: { media: true } } },
  });

  if (!item) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // 5. Confirm the requested url is one of this item's stored variants, so a
  //    valid item id can't proxy an arbitrary twimg URL.
  const allowedSrcs = collectItemVideoSrcs(item.twitterDetails?.media);
  if (!allowedSrcs.has(target)) {
    log.warn({ itemId, url: target }, "url not a stored variant of item");
    return NextResponse.json(
      { message: "media does not belong to item" },
      { status: 403 },
    );
  }

  const upstreamHeaders: Record<string, string> = {};
  const range = request.headers.get("range");
  if (range) upstreamHeaders.Range = range;

  let outcome: UpstreamOutcome;
  try {
    outcome = await fetchAllowlisted(
      parsed.toString(),
      upstreamHeaders,
      AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    );
  } catch (error) {
    log.error({ error, url: parsed.toString() }, "upstream fetch failed");
    return NextResponse.json(
      { message: "upstream fetch failed" },
      { status: 502 },
    );
  }

  if (!outcome.ok) {
    log.warn(
      { url: parsed.toString(), reason: outcome.reason },
      "upstream redirect rejected",
    );
    return new NextResponse(null, { status: outcome.status });
  }

  const upstream = outcome.response;

  if (upstream.status >= 400) {
    log.warn(
      { url: parsed.toString(), status: upstream.status },
      "upstream returned error",
    );
    return new NextResponse(null, { status: upstream.status });
  }

  // Reject an oversized body before streaming it. Content-Length may be absent
  // (chunked) — then we can't cap without buffering, so we proceed; twimg
  // reliably declares it.
  const contentLength = Number(upstream.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_UPSTREAM_BYTES) {
    await upstream.body?.cancel().catch(() => {});
    log.warn(
      { url: parsed.toString(), contentLength },
      "upstream response exceeds size cap",
    );
    return new NextResponse(null, { status: 413 });
  }

  const responseHeaders = new Headers();
  for (const key of PASSTHROUGH_RESPONSE_HEADERS) {
    const value = upstream.headers.get(key);
    if (value) responseHeaders.set(key, value);
  }
  // Only the Sec-Fetch-Site gate input is in Vary, so a cached response is only
  // safe to reuse when the gate decided on it. When it's present, keep the hot
  // path fully shared-cacheable; when it's absent (gate fell back to
  // Origin/Referer, which Vary doesn't key on) make the response uncacheable so
  // no cache can replay a first-party 200 to a cross-site embed.
  const gatedOnSecFetchSite = request.headers.get("sec-fetch-site") !== null;
  responseHeaders.set(
    "Cache-Control",
    gatedOnSecFetchSite ? CACHE_CONTROL : CACHE_CONTROL_FALLBACK,
  );
  responseHeaders.set("Vary", "Sec-Fetch-Site");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
