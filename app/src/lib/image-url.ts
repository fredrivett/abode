/**
 * Image URL helper for generating optimized proxy URLs with size presets.
 *
 * Uses Supabase image transforms to serve appropriately sized images.
 */

export type ImageSize = "thumb" | "grid" | "embed" | "detail" | "full";

const SIZE_PRESETS = {
  thumb: { w: 200, q: 80 }, // Small previews (e.g. room-card item strip)
  grid: { w: 800, q: 80 }, // Dashboard masonry grid (largest srcset candidate)
  embed: { w: 800, q: 90 }, // Embed widget thumbnails
  detail: { w: 1800, q: 90 }, // Detail dialog full view
  full: { q: 100 }, // Original quality (no resize)
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
  // Skip transforms for GIFs — Supabase converts transformed images to WebP,
  // which strips animation
  const isGif = fileKey.toLowerCase().endsWith(".gif");
  if (isGif) {
    return `/api/v1/images/${encodeURIComponent(fileKey)}`;
  }

  const params = SIZE_PRESETS[size];
  const searchParams = new URLSearchParams();

  if ("w" in params) {
    searchParams.set("w", String(params.w));
  }
  searchParams.set("q", String(params.q));

  return `/api/v1/images/${encodeURIComponent(fileKey)}?${searchParams.toString()}`;
}

/** Smaller widths offered alongside a resized proxy URL (see {@link proxyImageSrcSet}) */
const SRCSET_WIDTHS = [400, 600] as const;

/**
 * `sizes` for an image filling a dashboard grid column. `auto` lets browsers
 * that support it (lazy images, Chromium) use the laid-out width; the rest
 * fall back to roughly one of two phone columns, or a third of a wide screen
 */
export const GRID_IMAGE_SIZES = "auto, (max-width: 640px) 50vw, 33vw";

/**
 * A `srcset` for a resized image proxy URL: the URL's own width plus the
 * smaller {@link SRCSET_WIDTHS}, so a phone or a narrow column fetches a
 * smaller rendition and nothing ever fetches more than `src` would. Undefined
 * for anything else (unresized originals, GIFs, blob/third-party URLs).
 */
export function proxyImageSrcSet(src: string): string | undefined {
  const [path, query] = src.split("?", 2);
  if (!path.startsWith("/api/v1/images/") || !query) return undefined;
  const params = new URLSearchParams(query);
  const width = Number(params.get("w"));
  if (!width) return undefined;
  const widths = SRCSET_WIDTHS.filter((candidate) => candidate < width);
  if (widths.length === 0) return undefined;
  return [...widths, width]
    .map((candidate) => {
      const candidateParams = new URLSearchParams(params);
      candidateParams.set("w", String(candidate));
      return `${path}?${candidateParams.toString()} ${candidate}w`;
    })
    .join(", ");
}
