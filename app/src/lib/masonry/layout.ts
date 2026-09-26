/**
 * Masonry placement: each frame goes, in order, into the currently-shortest
 * column. Pure and deterministic — every masonry grid in the app lays out
 * through this.
 *
 * The property that matters is stability: a frame's column depends only on
 * the frames before it, so appending a page never moves frames already on
 * screen. (Row-balancing layouts, which sort a row's frames by height to pick
 * columns, re-sort the last row when a page fills it and jump those frames.)
 *
 * Passing the previous layout's columns keeps them too, so a frame changing
 * shape, being removed, or a frame inserted above only moves frames below it
 * in its own column instead of reshuffling everything after it.
 */

/** A frame's aspect — only the ratio of `width` to `height` matters. */
export type MasonryFrame = { key: string; width: number; height: number };

export type MasonryPlacement = {
  key: string;
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MasonryLayout = {
  placements: MasonryPlacement[];
  /** Total height of the tallest column (px) */
  height: number;
  /** Columns actually used — fewer than fit when there are fewer frames */
  columnCount: number;
  /** Each frame's column by key, for keeping columns on the next layout */
  columns: ReadonlyMap<string, number>;
};

/**
 * How many columns of at least `minColumnWidth` (plus gaps) fit, and their
 * stretched width — the geometry of `repeat(auto-fill, minmax(min, 1fr))`.
 */
export function masonryColumns({
  containerWidth,
  minColumnWidth,
  gap,
}: {
  containerWidth: number;
  minColumnWidth: number;
  gap: number;
}): { columnCount: number; columnWidth: number } {
  const columnCount = Math.max(
    1,
    Math.floor((containerWidth + gap) / (minColumnWidth + gap)),
  );
  const columnWidth = Math.max(
    0,
    (containerWidth - (columnCount - 1) * gap) / columnCount,
  );
  return { columnCount, columnWidth };
}

function shortestColumn({
  heights,
  tieBreak,
}: {
  heights: readonly number[];
  tieBreak?: readonly number[];
}): number {
  let best = 0;
  for (let column = 1; column < heights.length; column++) {
    const diff = heights[column] - heights[best];
    // Sub-pixel differences are ties, so rounding can't pick a visibly taller column
    if (diff < -0.5) best = column;
    else if (Math.abs(diff) <= 0.5 && tieBreak) {
      if (tieBreak[column] < tieBreak[best]) best = column;
    }
  }
  return best;
}

export function layoutMasonry({
  frames,
  columnCount: availableColumns,
  columnWidth,
  gap,
  previous,
}: {
  frames: readonly MasonryFrame[];
  columnCount: number;
  columnWidth: number;
  gap: number;
  /**
   * The previous layout. Frames it placed keep their column; new ones are
   * placed shortest-first. Ignored when the column count changed (a resize or
   * density change reflows everything — unavoidable).
   */
  previous?: Pick<MasonryLayout, "columns" | "columnCount">;
}): MasonryLayout {
  // Fewer frames than columns: use only as many columns as frames, centred,
  // at the normal column width (not stretched to fill the row)
  const columnCount = Math.max(
    1,
    Math.min(availableColumns, frames.length || 1),
  );
  const offsetX = ((availableColumns - columnCount) * (columnWidth + gap)) / 2;

  const heightOf = (frame: MasonryFrame) =>
    frame.width > 0 ? (columnWidth * frame.height) / frame.width : 0;

  const kept = new Map<string, number>();
  if (previous && previous.columnCount === columnCount) {
    for (const frame of frames) {
      const column = previous.columns.get(frame.key);
      if (column !== undefined) kept.set(frame.key, column);
    }
  }

  // Where the kept frames end up — breaks ties for new frames so inserts
  // (e.g. an upload at the top, where every column is at 0) go to the column
  // that's shortest overall rather than always the first
  const keptTotals = new Array<number>(columnCount).fill(0);
  for (const frame of frames) {
    const column = kept.get(frame.key);
    if (column !== undefined) keptTotals[column] += heightOf(frame) + gap;
  }

  const running = new Array<number>(columnCount).fill(0);
  const placements: MasonryPlacement[] = [];
  const columns = new Map<string, number>();
  for (const frame of frames) {
    const column =
      kept.get(frame.key) ??
      shortestColumn({ heights: running, tieBreak: keptTotals });
    const height = heightOf(frame);
    placements.push({
      key: frame.key,
      column,
      x: offsetX + column * (columnWidth + gap),
      y: running[column],
      width: columnWidth,
      height,
    });
    columns.set(frame.key, column);
    running[column] += height + gap;
  }

  const tallest = Math.max(0, ...running);
  return {
    placements,
    height: tallest > 0 ? tallest - gap : 0,
    columnCount,
    columns,
  };
}
