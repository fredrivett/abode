/**
 * Columns the masonry grid lays out: `repeat(auto-fill, minmax(frameWidth,
 * 1fr))` fits as many `frameWidth` columns (plus gaps) as the container allows.
 */
export function gridColumnCount({
  containerWidth,
  frameWidth,
  gap,
}: {
  containerWidth: number;
  frameWidth: number;
  gap: number;
}): number {
  return Math.max(1, Math.floor((containerWidth + gap) / (frameWidth + gap)));
}

/**
 * How many of `frameCount` frames to render so the grid only shows complete
 * rows while more pages are coming.
 *
 * The balanced masonry assigns each row's frames to columns by comparing them
 * with the row above, so a partial last row is balanced among just its own few
 * frames. When the next page fills that row it's rebalanced across every
 * column and those frames — at the bottom of the screen, right where the user
 * is looking as the load triggers — jump sideways. Holding the remainder back
 * until the next page arrives means an append only ever adds rows below;
 * rows already on screen are never rebalanced.
 *
 * Renders everything when there's nothing more to load, before the columns are
 * measured, or when there's less than one full row.
 */
export function completeRowFrameCount({
  frameCount,
  columnCount,
  hasMore,
}: {
  frameCount: number;
  columnCount: number | null;
  hasMore: boolean;
}): number {
  if (!hasMore || columnCount === null || frameCount < columnCount) {
    return frameCount;
  }
  return frameCount - (frameCount % columnCount);
}
