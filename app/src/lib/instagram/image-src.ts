import { getProxyImageUrl, type ImageSize } from "@/lib/image-url";

/**
 * Resolve the src for an Instagram image, preferring our re-hosted copy.
 *
 * cdninstagram URLs are signed and expire, so we re-host the cover; this helper
 * serves the durable copy via our image proxy and falls back to the original
 * cdninstagram URL when the download failed.
 */
export function instagramImageSrc(
  fileKey: string | null | undefined,
  fallbackUrl: string | null | undefined,
  size: ImageSize = "grid",
): string | undefined {
  if (fileKey) return getProxyImageUrl(fileKey, size);
  return fallbackUrl ?? undefined;
}
