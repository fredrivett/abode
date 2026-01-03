/**
 * Image URL helper for generating optimized proxy URLs with size presets.
 *
 * Uses Supabase image transforms to serve appropriately sized images.
 */

export type ImageSize = "grid" | "embed" | "detail" | "full";

const SIZE_PRESETS = {
  grid: { w: 300, q: 80 }, // Dashboard masonry grid (300px for retina support)
  embed: { w: 200, q: 75 }, // Embed widget thumbnails
  detail: { w: 1800, q: 85 }, // Detail dialog full view
  full: { q: 90 }, // Original quality (no resize)
} as const;

/**
 * Generate an optimized proxy URL for an image.
 *
 * @param fileKey - The Supabase storage file key
 * @param size - The size preset to use (default: 'grid')
 * @returns The proxy URL with transform query params
 */
export function getProxyImageUrl(
  fileKey: string,
  size: ImageSize = "grid",
): string {
  const params = SIZE_PRESETS[size];
  const searchParams = new URLSearchParams();

  if ("w" in params) {
    searchParams.set("w", String(params.w));
  }
  searchParams.set("q", String(params.q));

  return `/api/v1/images/${encodeURIComponent(fileKey)}?${searchParams.toString()}`;
}
