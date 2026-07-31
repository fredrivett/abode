import { lookup as dnsLookup } from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import ipaddr from "ipaddr.js";
import {
  Agent,
  buildConnector,
  type RequestInit as UndiciRequestInit,
  fetch as undiciFetch,
} from "undici";

/**
 * SSRF-safe fetch.
 *
 * Every fetch of an attacker-controlled URL (a URL a user saved) must go
 * through here instead of the global `fetch`. It enforces four boundaries:
 *
 *  1. Protocol allowlist — only `http:`/`https:` (no `file:`, `gopher:`, …).
 *  2. Destination allowlist — an address is reachable only if `ipaddr.js`
 *     classifies it as `unicast`. Everything else is refused: loopback,
 *     link-local (incl. the `169.254.169.254` cloud-metadata IP), private,
 *     CGNAT, unique-local, multicast, broadcast, and the IANA special-purpose
 *     ranges (TEST-NET, benchmarking, protocol assignments, discard, …).
 *  3. Safe redirects — redirects are followed manually and each hop's URL is
 *     re-validated before it is fetched; the hop count is capped.
 *  4. Resource bounds — an overall timeout and a max-bytes cap on the response
 *     body (rejecting an over-cap `Content-Length` up front and aborting the
 *     stream if it runs over) so a huge or slow-loris page can't exhaust the
 *     worker.
 *
 * Nothing can change between check and connect, which is what closes DNS
 * rebinding. An IP literal is fixed, so {@link assertSafeUrl} settles it before
 * the request. A hostname is settled by {@link validatingLookup} *inside* the
 * undici connector: `net.connect` dials the addresses that lookup returns, so
 * there is no second resolution for a hostile 0-TTL resolver to answer
 * differently. {@link assertSafeUrl} also pre-resolves hostnames, but only to
 * fail fast with a typed error — the connector is what makes it safe.
 *
 * The dispatcher is passed per request. It must never be installed via
 * `setGlobalDispatcher`: that would route every other fetch in the app through
 * this pool and this policy.
 *
 * A blocked or over-limit request throws {@link SsrfBlockedError} /
 * {@link SafeFetchError}. Call sites already treat a fetch failure as a normal
 * failure (the item ends up `failed`), so a block surfaces the same way — never
 * a crash.
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

/**
 * `redirect` and `dispatcher` are withheld: redirects are followed manually and
 * the dispatcher is the SSRF gate, so neither is the caller's to set.
 */
export type SafeFetchOptions = Omit<
  UndiciRequestInit,
  "redirect" | "dispatcher"
> & {
  /** Overall deadline for the whole request incl. redirects (default ~10s). */
  timeoutMs?: number;
  /** Reject a response body larger than this many bytes (default ~15 MB). */
  maxBytes?: number;
  /** Max redirect hops to follow (default 5). */
  maxRedirects?: number;
};

// ── IP classification ───────────────────────────────────────────────────────

/**
 * True if `ip` is NOT a public routable address and must be refused.
 *
 * `ipaddr.js` owns the range table, so the IANA special-purpose registries stay
 * its problem, not ours: `unicast` is the single category we accept and every
 * other classification is a block. Fails closed — an address that won't parse
 * is blocked. Exported for exhaustive unit testing.
 */
export function isBlockedIp(ip: string): boolean {
  let parsed: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsed = ipaddr.parse(ip);
  } catch {
    return true;
  }
  // `::ffff:a.b.c.d` reaches the same host as `a.b.c.d`, so classify the address
  // it wraps — `ipv4Mapped` is never `unicast` and would block public hosts too.
  if (parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress()) {
    return parsed.toIPv4Address().range() !== "unicast";
  }
  return parsed.range() !== "unicast";
}

// ── Connect-time gate ───────────────────────────────────────────────────────

/**
 * DNS answers reach the socket through here, so this is where a hostname's
 * destination is decided: whatever survives is exactly what `net.connect`
 * dials, with no second resolution in between. `net` asks with `all: true`, but
 * the single-address form is honoured too because that is its choice, not ours.
 */
const validatingLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, options, (error, address, family) => {
    if (error) {
      callback(error, "");
      return;
    }
    const answers = Array.isArray(address) ? address : [{ address, family }];
    for (const answer of answers) {
      if (isBlockedIp(answer.address)) {
        callback(
          new SsrfBlockedError(
            "blocked_address",
            `host ${hostname} resolves to blocked address ${answer.address}`,
          ),
          "",
        );
        return;
      }
    }
    callback(null, address, family);
  });
};

const ssrfAgent = new Agent({
  connect: buildConnector({ lookup: validatingLookup }),
});

/**
 * undici reports a connector refusal as `TypeError: fetch failed` with the real
 * error on `cause`; dig ours back out so the taxonomy survives the round trip.
 */
function findSafeFetchCause(error: unknown): SafeFetchError | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth++) {
    if (current instanceof SafeFetchError) return current;
    current = current.cause;
  }
  return null;
}

// ── URL validation ──────────────────────────────────────────────────────────

/** IPv6 literals arrive from `URL.hostname` bracketed (`[::1]`); strip them. */
function unbracketHost(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

/**
 * Reject once `signal` fires. `dns.promises.lookup` takes no signal, so a
 * blackholed nameserver would otherwise hang a worker past `timeoutMs`, once
 * per redirect hop. The abandoned lookup keeps running — it can't be cancelled
 * — but nothing waits on it.
 */
function withDeadline<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    void work
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
}

/**
 * Validate a single URL: enforce the protocol allowlist and ensure the host is
 * a public destination. For an IP literal we classify it directly (no DNS) and
 * that verdict is final, since a literal can't change under us. For a hostname
 * we resolve every A/AAAA record and reject if *any* is internal — that also
 * catches numeric/octal/hex host tricks (e.g. `http://2130706433/`), since the
 * resolver maps them to the same address the socket would reach. Returns the
 * parsed URL on success; throws {@link SsrfBlockedError} otherwise.
 */
async function assertSafeUrl(
  rawUrl: string,
  signal: AbortSignal,
): Promise<URL> {
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
  const resolved = await withDeadline(
    lookup(host, { all: true, verbatim: true }),
    signal,
  );
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
  source: NodeReadableStream<Uint8Array> | null,
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

  let current = await assertSafeUrl(rawUrl, signal);

  for (let hop = 0; ; hop++) {
    let response: Awaited<ReturnType<typeof undiciFetch>>;
    try {
      response = await undiciFetch(current.toString(), {
        ...init,
        redirect: "manual",
        signal,
        dispatcher: ssrfAgent,
      });
    } catch (error) {
      const blocked = findSafeFetchCause(error);
      if (blocked) throw blocked;
      throw error;
    }

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
      current = await assertSafeUrl(next.toString(), signal);
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
      headers: [...response.headers],
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
