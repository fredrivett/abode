/**
 * Normalize a referrer URL for privacy-safe storage.
 * - Strips query parameters (may contain sensitive data)
 * - Strips hash fragments
 * - Normalizes trailing slashes
 * - Returns null for invalid/empty URLs or internal referrers
 */
export function normalizeReferrerUrl(referrer: string | null): {
  url: string;
  domain: string;
} | null {
  if (!referrer) return null;

  try {
    const parsed = new URL(referrer);

    // Skip localhost/dev referrers
    if (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "[::1]"
    ) {
      return null;
    }

    // Skip internal referrers (abode.fyi itself)
    if (
      parsed.hostname === "abode.fyi" ||
      parsed.hostname === "www.abode.fyi" ||
      parsed.hostname.endsWith(".abode.fyi")
    ) {
      return null;
    }

    // Build normalized URL: origin + pathname only (no query params or hash)
    const normalizedPath = parsed.pathname.replace(/\/+$/, "") || "/";
    const url = `${parsed.origin}${normalizedPath}`;
    const domain = parsed.hostname;

    return { url, domain };
  } catch {
    return null;
  }
}
