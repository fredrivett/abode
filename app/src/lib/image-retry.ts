/**
 * Backoff before each retry of a failed image load. The server retries its own
 * DB lookups too; these cover a blip that outlasts that (or a dropped request).
 */
export const IMAGE_RETRY_DELAYS_MS = [1000, 4000] as const;

/**
 * Whether a failed load of `src` is worth retrying: only our own same-origin
 * URLs (the image proxy, map tiles, static assets), where a failure is likely a
 * transient 5xx. Third-party URLs (legacy twimg/cdninstagram fallbacks) are
 * usually permanently gone or signed — a cache-busting param could break them —
 * and blob:/data: URLs are local bytes that can't fail transiently.
 */
export function isRetryableImageSrc(src: string): boolean {
  return src.startsWith("/") && !src.startsWith("//");
}

/**
 * The URL for a given load attempt. Retries add a `retry` param so the request
 * bypasses any cached failure; the image proxy ignores unknown params.
 */
export function imageSrcForAttempt({
  src,
  attempt,
}: {
  src: string;
  attempt: number;
}): string {
  if (attempt === 0) return src;
  // The param must precede any #fragment, which the browser never sends
  const hashIndex = src.indexOf("#");
  const url = hashIndex === -1 ? src : src.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : src.slice(hashIndex);
  return `${url}${url.includes("?") ? "&" : "?"}retry=${attempt}${hash}`;
}
