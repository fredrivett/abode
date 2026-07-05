/**
 * Book cover aspect-ratio helpers.
 *
 * Cover dimensions are measured at ingest (see `handleBookUrl` in
 * `trigger/classify-url.ts`) and stored on `item.meta` as
 * `coverWidth`/`coverHeight`. Items without them fall back to 2:3, the
 * most common book cover shape.
 */

export const DEFAULT_BOOK_COVER_RATIO = 2 / 3;

// Clamp to portrait-ish shapes: narrower than 1:2 or wider than square is
// almost certainly a bad scan (e.g. a banner stored as a cover), and
// object-cover cropping beats a broken-looking book
const MIN_COVER_RATIO = 0.5;
const MAX_COVER_RATIO = 1;

/**
 * Padding around the book on grid tiles, as fractions of the tile's width
 * (CSS % padding resolves against width on all four sides). Vertical is
 * larger because the 3D cover pops taller toward the viewer and the contact
 * shadow hangs below, which visually eats the top/bottom gaps.
 */
export const BOOK_TILE_PADDING_X = 0.16;
export const BOOK_TILE_PADDING_Y = 0.22;

/**
 * Width/height ratio for a book cover from item meta, clamped to a
 * plausible portrait range. Falls back to 2:3 when dimensions are missing
 * or invalid.
 */
export function getBookCoverRatio(
  meta: Record<string, unknown> | null | undefined,
): number {
  const width = meta?.coverWidth;
  const height = meta?.coverHeight;
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    width <= 0 ||
    height <= 0
  ) {
    return DEFAULT_BOOK_COVER_RATIO;
  }
  return Math.min(Math.max(width / height, MIN_COVER_RATIO), MAX_COVER_RATIO);
}

/**
 * Masonry frame dimensions for a book grid tile: the inner cover keeps its
 * true aspect ratio, surrounded by the padding fractions above.
 *
 * Works at any tile width because CSS percentage padding resolves against
 * width for all four sides — the card pads with the same fractions, and
 * this frame ratio accounts for them.
 */
export function getBookTileFrame(
  meta: Record<string, unknown> | null | undefined,
): { width: number; height: number } {
  const innerWidth = 1 - 2 * BOOK_TILE_PADDING_X;
  return {
    width: 1,
    height: innerWidth / getBookCoverRatio(meta) + 2 * BOOK_TILE_PADDING_Y,
  };
}
