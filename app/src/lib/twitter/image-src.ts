import { getProxyImageUrl, type ImageSize } from "@/lib/image-url";

/**
 * Resolve the src for a tweet image, preferring our re-hosted copy.
 *
 * Tweet photos/avatars/card images used to be hotlinked straight from twimg,
 * which rots when the tweet is deleted or the CDN URL rotates. We now re-host
 * them; this helper serves the durable copy via our image proxy and falls back
 * to the original twimg URL for items captured before re-hosting (or when the
 * download failed).
 */
export function twitterImageSrc(
  fileKey: string | null | undefined,
  fallbackUrl: string | null | undefined,
  size: ImageSize = "grid",
): string | undefined {
  if (fileKey) return getProxyImageUrl(fileKey, size);
  return fallbackUrl ?? undefined;
}
