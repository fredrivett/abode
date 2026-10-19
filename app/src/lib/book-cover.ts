/**
 * Book cover aspect-ratio helpers.
 *
 * Cover dimensions are measured at ingest (see `handleBookUrl` in
 * `trigger/classify-url.ts`) and stored on `item.meta` as
 * `coverWidth`/`coverHeight`. Items without them fall back to 2:3, the
 * most common book cover shape.
 */

import type { ImageColor } from "@/lib/types/item";

export const DEFAULT_BOOK_COVER_RATIO = 2 / 3;

// Page fore-edge: striations under a light-to-shadow wash. The 3D cover renders
// it on a plane rotated away from the viewer, so the lines foreshorten with depth
export const BOOK_PAGE_EDGE_BG = [
  "linear-gradient(to right, rgba(255,255,255,0.3), rgba(0,0,0,0) 25%, rgba(0,0,0,0.06) 60%, rgba(0,0,0,0.24))",
  "repeating-linear-gradient(90deg, #f6f1e7 0px, #f6f1e7 2px, #cbc0a9 3px, #f6f1e7 4px)",
].join(", ");

// Spine hinge: shading at the spine edge, a highlight ridge, then the groove
export const BOOK_SPINE_HINGE_BG =
  "linear-gradient(to right, rgba(0,0,0,0.28), rgba(0,0,0,0.05) 3%, rgba(255,255,255,0.14) 4.5%, rgba(0,0,0,0.22) 7%, rgba(0,0,0,0) 10%)";

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
export function getBookCoverRatio(meta: unknown): number {
  const width = isRecord(meta) ? meta.coverWidth : undefined;
  const height = isRecord(meta) ? meta.coverHeight : undefined;
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

/**
 * Most dominant color (by Vision score) from an analysed cover, as a hex
 * string. Used as an opaque placeholder behind the lazy-loaded cover image so
 * the book shows its own primary color instead of a transparent gap while the
 * image loads. Returns undefined when the cover has no color data yet.
 */
export function getDominantCoverColor(
  colors: ImageColor[] | null | undefined,
): string | undefined {
  if (!colors || colors.length === 0) return undefined;
  return [...colors].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]?.hex;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isImageColor(value: unknown): value is ImageColor {
  return isRecord(value) && typeof value.hex === "string";
}

/**
 * {@link getDominantCoverColor} straight from the stored `colors` JSON, for
 * server code reading the raw column. Ignores malformed entries.
 */
export function getStoredCoverColor(colors: unknown): string | null {
  const parsed = Array.isArray(colors) ? colors.filter(isImageColor) : [];
  return getDominantCoverColor(parsed) ?? null;
}
