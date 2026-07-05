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

/** Fraction of a grid tile's width used as padding around the book */
export const BOOK_TILE_PADDING_FRACTION = 0.1;

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
 * true aspect ratio, surrounded by equal padding on all sides.
 *
 * Works at any tile width because CSS percentage padding resolves against
 * width for all four sides — the card pads with
 * `BOOK_TILE_PADDING_FRACTION * 100`%, and this frame ratio accounts for it.
 */
export function getBookTileFrame(
  meta: Record<string, unknown> | null | undefined,
): { width: number; height: number } {
  const innerWidth = 1 - 2 * BOOK_TILE_PADDING_FRACTION;
  return {
    width: 1,
    height:
      innerWidth / getBookCoverRatio(meta) + 2 * BOOK_TILE_PADDING_FRACTION,
  };
}
