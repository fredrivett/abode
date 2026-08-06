import { X509Certificate } from "node:crypto";

/**
 * AIA (Authority Information Access) chain completion — the pure algorithm.
 *
 * Some servers present only their leaf certificate and omit the intermediate(s)
 * that link it to a trusted root (a common misconfiguration on old stacks).
 * Browsers recover by "AIA chasing" — reading the `CA Issuers` URL embedded in a
 * cert and fetching the missing issuer — but Node's TLS stack does not, so a
 * `fetch` dies with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` / `UNABLE_TO_GET_ISSUER_
 * CERT` and a reachable site gets mislabelled `source_unreachable`.
 *
 * {@link chaseAiaChain} walks the AIA links, fetching each issuer up the chain,
 * and returns the intermediates so a retry can supply them as `ca`. It never
 * adds a self-signed (root) certificate: anchors must come from the system
 * store, and the verifying retry still has to terminate at a bundled root — so a
 * malicious server pointing AIA at its own certs cannot manufacture trust.
 *
 * This module is deliberately IO-free: all network access is injected via
 * {@link AiaResolver}, so the walk is fully unit-testable offline. The
 * SSRF-gated production resolver lives in `safe-fetch.ts` alongside `safeFetch`.
 */

/** Cap AIA hops so a hostile/looping AIA graph can't fan out unbounded. */
const MAX_AIA_HOPS = 4;

const CERT_CHAIN_ERROR_CODES: ReadonlySet<string> = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
]);

function errorCodeOf(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  const { code } = error;
  return typeof code === "string" ? code : undefined;
}

/**
 * True if `error` (or a cause within it) is Node's "couldn't build a chain to a
 * trusted root" — the only failure AIA completion can help with.
 */
export function isCertChainError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth++) {
    const code = errorCodeOf(current);
    if (code !== undefined && CERT_CHAIN_ERROR_CODES.has(code)) return true;
    current = current.cause;
  }
  return false;
}

/** Extract the first http(s) `CA Issuers` URL from an X509 `infoAccess` blob. */
function caIssuersUri(infoAccess: string | undefined): string | null {
  if (!infoAccess) return null;
  const prefix = "CA Issuers - URI:";
  for (const line of infoAccess.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(prefix)) continue;
    const uri = trimmed.slice(prefix.length).trim();
    if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;
  }
  return null;
}

/** IPv6 literals arrive from `URL.hostname` bracketed (`[::1]`); strip them. */
function bareHost(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

/** Injectable IO for {@link chaseAiaChain} so the walk is unit-testable offline. */
export interface AiaResolver {
  /** Read the leaf cert a server presents (DER), or null if unobtainable. */
  getLeafCertificate(
    host: string,
    port: number,
    signal: AbortSignal,
  ): Promise<Buffer | null>;
  /** Fetch an issuer certificate by AIA URL (DER or PEM bytes), or null. */
  fetchCertificate(uri: string, signal: AbortSignal): Promise<Buffer | null>;
  /** Subjects of the trust anchors we already have — walk stops on reaching one. */
  trustedRootSubjects(): ReadonlySet<string>;
}

/**
 * Walk a server's AIA chain and return the missing intermediate certificates
 * (PEM), most-specific first, to hand a retry as `ca`. Returns `[]` when
 * completion is impossible or unhelpful (non-https, no leaf, no AIA link, or the
 * next issuer is a self-signed root). Best-effort: any error yields `[]` so the
 * original fetch failure is what surfaces.
 */
export async function chaseAiaChain(
  url: URL,
  signal: AbortSignal,
  deps: AiaResolver,
): Promise<string[]> {
  if (url.protocol !== "https:") return [];
  const host = bareHost(url.hostname);
  const port = url.port ? Number(url.port) : 443;
  const collected: string[] = [];
  try {
    const leafRaw = await deps.getLeafCertificate(host, port, signal);
    if (!leafRaw) return [];
    const trusted = deps.trustedRootSubjects();
    let cert = new X509Certificate(leafRaw);
    for (let hop = 0; hop < MAX_AIA_HOPS; hop++) {
      if (cert.subject === cert.issuer) break; // self-signed — nothing above
      if (trusted.has(cert.issuer)) break; // issuer is a trusted anchor; done
      const uri = caIssuersUri(cert.infoAccess);
      if (!uri) break;
      const der = await deps.fetchCertificate(uri, signal);
      if (!der) break;
      const issuer = new X509Certificate(der);
      // Never add a self-signed root — trust anchors must come from the system
      // store; the verifying retry still has to reach one on its own.
      if (issuer.subject === issuer.issuer) break;
      collected.push(issuer.toString());
      cert = issuer;
    }
  } catch {
    return [];
  }
  return collected;
}
