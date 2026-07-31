import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF-safe fetch.
 *
 * Every fetch of an attacker-controlled URL (a URL a user saved) must go
 * through here instead of the global `fetch`. It enforces four boundaries:
 *
 *  1. Protocol allowlist — only `http:`/`https:` (no `file:`, `gopher:`, …).
 *  2. Destination allowlist — the host must resolve exclusively to public,
 *     routable addresses. IP literals are classified directly; hostnames are
 *     resolved (DNS) and *every* returned address is classified. Loopback,
 *     link-local (incl. the `169.254.169.254` cloud-metadata IP), private,
 *     unique-local, CGNAT, and the other non-public ranges are rejected.
 *  3. Safe redirects — redirects are followed manually and each hop's URL is
 *     re-validated (protocol + resolved addresses) before it is fetched; the
 *     hop count is capped.
 *  4. Resource bounds — an overall timeout and a max-bytes cap on the response
 *     body (rejecting an over-cap `Content-Length` up front and aborting the
 *     stream if it runs over) so a huge or slow-loris page can't exhaust the
 *     worker.
 *
 * A blocked or over-limit request throws {@link SsrfBlockedError} /
 * {@link SafeFetchError}. Call sites already treat a fetch failure as a normal
 * failure (the item ends up `failed`), so a block surfaces the same way — never
 * a crash.
 *
 * ── Residual: DNS rebinding (TOCTOU) ────────────────────────────────────────
 * This is a resolve-and-block baseline. We resolve the host and classify the
 * addresses, then hand the (unchanged) URL to `fetch`, which resolves the host
 * *again* to open the socket. A hostile authoritative DNS server with a 0-TTL
 * record could answer our check with a public IP and answer `fetch`'s
 * resolution with a private one, slipping past the gate. Closing this fully
 * requires pinning the socket to the address we validated (e.g. an undici
 * `Agent` with a custom `connect`/`lookup`). We deliberately do NOT do that
 * here: undici is only a transitive dependency, and pinning cleanly would mean
 * promoting it to a direct dependency (a maintainer decision) — see the PR
 * notes. The baseline already closes the audited exploit paths (IP-literal
 * targets and hostnames that resolve to internal addresses); rebinding is the
 * remaining, documented gap.
 */

/** ~10s: generous for a page/image fetch, short enough to bound a hung worker. */
const DEFAULT_TIMEOUT_MS = 10_000;
/** ~15 MB: comfortably covers HTML pages and og/product images we re-host. */
const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;
/** Cap redirect chains (t.co, amzn.eu, bit.ly, …) so they can't loop or wander. */
const DEFAULT_MAX_REDIRECTS = 5;

export type SafeFetchErrorCode =
  | "blocked_protocol"
  | "blocked_address"
  | "unresolvable_host"
  | "invalid_url"
  | "invalid_redirect"
  | "too_many_redirects"
  | "body_too_large";

/**
 * Raised by {@link safeFetch} for a request it refused or aborted on safety
 * grounds. Distinct from an upstream HTTP error or a network failure so callers
 * (and `classifyFailureReason`) can tell "we blocked this" from "the site was
 * down".
 */
export class SafeFetchError extends Error {
  readonly code: SafeFetchErrorCode;

  constructor(code: SafeFetchErrorCode, message: string) {
    super(message);
    this.name = "SafeFetchError";
    this.code = code;
  }
}

/**
 * The request targeted a destination we refuse to reach: a non-http(s)
 * protocol, or a host that (partly) resolves to a private/internal address.
 * This is the SSRF gate firing.
 */
export class SsrfBlockedError extends SafeFetchError {
  constructor(
    code: Extract<
      SafeFetchErrorCode,
      | "blocked_protocol"
      | "blocked_address"
      | "unresolvable_host"
      | "invalid_url"
    >,
    message: string,
  ) {
    super(code, message);
    this.name = "SsrfBlockedError";
  }
}

export type SafeFetchOptions = Omit<RequestInit, "redirect"> & {
  /** Overall deadline for the whole request incl. redirects (default ~10s). */
  timeoutMs?: number;
  /** Reject a response body larger than this many bytes (default ~15 MB). */
  maxBytes?: number;
  /** Max redirect hops to follow (default 5). */
  maxRedirects?: number;
};

// ── IP classification ───────────────────────────────────────────────────────

/** Parse a dotted-quad IPv4 string into its 4 octets, or null if malformed. */
function ipv4ToOctets(ip: string): [number, number, number, number] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    octets.push(n);
  }
  return [octets[0], octets[1], octets[2], octets[3]];
}

/**
 * True if an IPv4 address is anything other than a public, routable unicast
 * address. Blocks (see report):
 *   0.0.0.0/8, 10/8, 100.64/10 (CGNAT), 127/8 (loopback),
 *   169.254/16 (link-local, incl. 169.254.169.254 metadata), 172.16/12,
 *   192.168/16, 224/4 (multicast) and 240/4 (reserved, incl. 255.255.255.255).
 */
function isBlockedIpv4Octets(o: [number, number, number, number]): boolean {
  const [a, b, c] = o;
  if (a === 0) return true; // 0.0.0.0/8 ("this host")
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a >= 224) return true; // 224/4 multicast + 240/4 reserved (incl. broadcast)
  void c;
  return false;
}

/**
 * Expand any valid IPv6 textual form (incl. `::` compression and an embedded
 * trailing IPv4 like `::ffff:127.0.0.1`) into its 16 bytes, or null if it can't
 * be parsed. Assumes the input already passed `isIP(...) === 6`.
 */
function ipv6ToBytes(input: string): number[] | null {
  // Drop a zone id (e.g. "fe80::1%eth0") — irrelevant to classification.
  let s = input;
  const zone = s.indexOf("%");
  if (zone !== -1) s = s.slice(0, zone);

  // Rewrite a trailing embedded IPv4 ("…:a.b.c.d") into two hex groups so the
  // rest can be parsed uniformly.
  if (s.includes(".")) {
    const lastColon = s.lastIndexOf(":");
    if (lastColon === -1) return null;
    const v4 = ipv4ToOctets(s.slice(lastColon + 1));
    if (!v4) return null;
    const g1 = ((v4[0] << 8) | v4[1]).toString(16);
    const g2 = ((v4[2] << 8) | v4[3]).toString(16);
    s = `${s.slice(0, lastColon + 1)}${g1}:${g2}`;
  }

  const doubleColon = s.indexOf("::");
  let head: string[];
  let tail: string[];
  if (doubleColon !== -1) {
    // Exactly one "::" is allowed.
    if (s.indexOf("::", doubleColon + 1) !== -1) return null;
    const [headStr, tailStr] = s.split("::");
    head = headStr ? headStr.split(":") : [];
    tail = tailStr ? tailStr.split(":") : [];
  } else {
    head = s.split(":");
    tail = [];
  }

  const known = head.length + tail.length;
  let groups: string[];
  if (doubleColon !== -1) {
    if (known > 8) return null;
    groups = [...head, ...Array(8 - known).fill("0"), ...tail];
  } else {
    if (known !== 8) return null;
    groups = head;
  }

  const bytes: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    const n = Number.parseInt(g, 16);
    bytes.push((n >> 8) & 0xff, n & 0xff);
  }
  return bytes.length === 16 ? bytes : null;
}

/**
 * True if an IPv6 address is anything other than a public, routable unicast
 * address. Handles IPv4-mapped/compatible forms by re-checking the embedded
 * IPv4. Blocks `::` (unspecified), `::1` (loopback) and the whole IPv4-compat
 * `::/96`, IPv4-mapped `::ffff:0:0/96` (via the embedded v4), link-local
 * `fe80::/10`, unique-local `fc00::/7`, and multicast `ff00::/8`.
 */
function isBlockedIpv6Bytes(b: number[]): boolean {
  const first10Zero = b.slice(0, 10).every((x) => x === 0);

  // IPv4-mapped ::ffff:0:0/96 → classify the embedded IPv4.
  if (first10Zero && b[10] === 0xff && b[11] === 0xff) {
    return isBlockedIpv4Octets([b[12], b[13], b[14], b[15]]);
  }
  // ::/96 covers :: (unspecified), ::1 (loopback) and IPv4-compatible (deprecated,
  // non-routable) — none are valid public destinations.
  if (b.slice(0, 12).every((x) => x === 0)) return true;
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true; // fe80::/10 link-local
  if ((b[0] & 0xfe) === 0xfc) return true; // fc00::/7 unique-local
  if (b[0] === 0xff) return true; // ff00::/8 multicast
  return false;
}

/**
 * True if `ip` (a literal, already IP-shaped) is NOT a public routable address
 * and must be refused. Fails closed: anything unparseable is treated as blocked.
 * Exported for exhaustive unit testing.
 */
export function isBlockedIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) {
    const octets = ipv4ToOctets(ip);
    return octets ? isBlockedIpv4Octets(octets) : true;
  }
  if (family === 6) {
    const bytes = ipv6ToBytes(ip);
    return bytes ? isBlockedIpv6Bytes(bytes) : true;
  }
  return true; // not an IP literal — fail closed
}

// ── URL validation ──────────────────────────────────────────────────────────

/** IPv6 literals arrive from `URL.hostname` bracketed (`[::1]`); strip them. */
function unbracketHost(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

/**
 * Validate a single URL: enforce the protocol allowlist and ensure the host is
 * a public destination. For an IP literal we classify it directly (no DNS); for
 * a hostname we resolve every A/AAAA record and reject if *any* is internal —
 * that also catches numeric/octal/hex host tricks (e.g. `http://2130706433/`),
 * since the resolver maps them to the same address `fetch` would connect to.
 * Returns the parsed URL on success; throws {@link SsrfBlockedError} otherwise.
 */
async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError("invalid_url", `invalid url: ${rawUrl}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfBlockedError(
      "blocked_protocol",
      `blocked protocol: ${url.protocol}`,
    );
  }

  const host = unbracketHost(url.hostname);

  if (isIP(host) !== 0) {
    if (isBlockedIp(host)) {
      throw new SsrfBlockedError(
        "blocked_address",
        `blocked address literal: ${host}`,
      );
    }
    return url;
  }

  // Hostname — resolve every address and classify them all.
  const resolved = await lookup(host, { all: true, verbatim: true });
  if (resolved.length === 0) {
    throw new SsrfBlockedError("unresolvable_host", `no addresses for ${host}`);
  }
  for (const { address } of resolved) {
    if (isBlockedIp(address)) {
      throw new SsrfBlockedError(
        "blocked_address",
        `host ${host} resolves to blocked address ${address}`,
      );
    }
  }
  return url;
}

// ── Body size cap ───────────────────────────────────────────────────────────

/**
 * Wrap a response body stream so it errors (aborting the download) the moment
 * cumulative bytes exceed `maxBytes`. Guards bodies with no/inaccurate
 * Content-Length (chunked, slow-loris). Null in → null out (e.g. HEAD).
 */
function capBodyStream(
  source: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): ReadableStream<Uint8Array> | null {
  if (!source) return null;
  const reader = source.getReader();
  let total = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        controller.error(
          new SafeFetchError(
            "body_too_large",
            `response body exceeded ${maxBytes} bytes`,
          ),
        );
        return;
      }
      controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * SSRF-safe replacement for `fetch`. See the file header for the full contract.
 * Drop-in for the call sites' existing usage: pass the same method/headers and
 * read `.ok` / `.status` / `.headers` / `.url` / `.text()` / `.arrayBuffer()`
 * as before. The `redirect` option is ignored — redirects are always followed
 * manually and re-validated.
 */
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBytes = DEFAULT_MAX_BYTES,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    signal: callerSignal,
    ...init
  } = options;

  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = callerSignal
    ? AbortSignal.any([callerSignal, timeoutSignal])
    : timeoutSignal;

  const isHead =
    typeof init.method === "string" && init.method.toUpperCase() === "HEAD";

  let current = await assertSafeUrl(rawUrl);

  for (let hop = 0; ; hop++) {
    const response = await fetch(current.toString(), {
      ...init,
      redirect: "manual",
      signal,
    });

    const isRedirect =
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.has("location");

    if (isRedirect) {
      // Drain the redirect body so the socket can be reused.
      await response.body?.cancel().catch(() => {});
      if (hop >= maxRedirects) {
        throw new SafeFetchError(
          "too_many_redirects",
          `exceeded ${maxRedirects} redirects`,
        );
      }
      const location = response.headers.get("location") ?? "";
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        throw new SafeFetchError(
          "invalid_redirect",
          `invalid redirect location: ${location}`,
        );
      }
      current = await assertSafeUrl(next.toString());
      continue;
    }

    // Final response. Reject an over-cap declared length up front (skip for HEAD,
    // which transfers no body but may advertise the would-be GET size).
    if (!isHead) {
      const declared = Number(response.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > maxBytes) {
        await response.body?.cancel().catch(() => {});
        throw new SafeFetchError(
          "body_too_large",
          `Content-Length ${declared} exceeds ${maxBytes} bytes`,
        );
      }
    }

    const body = isHead ? null : capBodyStream(response.body, maxBytes);
    const safe = new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
    // Preserve the final URL (after any redirects) so callers that read
    // `response.url` for redirect detection keep working. `current` is the hop
    // we just fetched — the original URL when nothing redirected, else the final
    // hop — matching native fetch's normalized `response.url`. It isn't settable
    // via the constructor, so shadow the prototype getter.
    Object.defineProperty(safe, "url", {
      value: current.toString(),
      enumerable: true,
    });
    return safe;
  }
}
