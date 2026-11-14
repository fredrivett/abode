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

/** Room preview tiles in the embed API and the share dialog's live preview */
const ROOM_PREVIEW = { w: 200, q: 75 } as const;

/** Proxy URL for a room preview tile (resized even for GIFs: tiles are stills) */
export function roomPreviewImageUrl(fileKey: string): string {
  return `/api/v1/images/${encodeURIComponent(fileKey)}?w=${ROOM_PREVIEW.w}&q=${ROOM_PREVIEW.q}`;
}

/** Smaller widths offered alongside a resized proxy URL (see {@link proxyImageSrcSet}) */
const SRCSET_WIDTHS = [400, 600] as const;

type ImageTransform = { width: number; quality: number };

/**
 * Every resize the proxy runs: each resized preset at its quality, the srcset
 * widths below it at the same quality, and the room preview tile
 */
const IMAGE_TRANSFORMS: readonly ImageTransform[] = [
  ...Object.values(SIZE_PRESETS).flatMap((preset) =>
    "w" in preset
      ? [...SRCSET_WIDTHS.filter((w) => w < preset.w), preset.w].map(
          (width) => ({ width, quality: preset.q }),
        )
      : [],
  ),
  { width: ROOM_PREVIEW.w, quality: ROOM_PREVIEW.q },
];

/**
 * The resize the image proxy runs for a request's `w`/`q` params: the app's
 * own sizes as asked, anything else snapped to the nearest of them (the
 * smallest width at least as wide, then the closest quality), so older URLs
 * keep working. Undefined (serve the original) without a positive `w`.
 */
export function imageTransformFor(
  searchParams: URLSearchParams,
): ImageTransform | undefined {
  const requestedWidth = Number.parseInt(searchParams.get("w") ?? "", 10);
  if (!(requestedWidth > 0)) return undefined;
  const requestedQuality =
    Number.parseInt(searchParams.get("q") ?? "", 10) || 80;

  const widths = IMAGE_TRANSFORMS.map((t) => t.width);
  const wideEnough = widths.filter((w) => w >= requestedWidth);
  const width =
    wideEnough.length > 0 ? Math.min(...wideEnough) : Math.max(...widths);
  const distance = (t: ImageTransform) =>
    Math.abs(t.quality - requestedQuality);
  return IMAGE_TRANSFORMS.filter((t) => t.width === width).reduce((best, t) =>
    distance(t) < distance(best) ||
    (distance(t) === distance(best) && t.quality > best.quality)
      ? t
      : best,
  );
}

/**
 * `sizes` for a grid image whose cell width isn't known: picks the full grid
 * rendition, as before srcsets (see `useGridImageSizes`)
 */
export const GRID_IMAGE_FALLBACK_SIZES = `${SIZE_PRESETS.grid.w}px`;

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
