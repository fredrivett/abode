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

/** What a frame's aspect can depend on: the rendered column width (px). */
export type MasonryGeometry = { columnWidth: number };

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
  /** Columns laid out against (all that fit, even if some are empty) */
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

function shortestColumn(heights: readonly number[]): number {
  let best = 0;
  for (let column = 1; column < heights.length; column++) {
    // Sub-pixel differences are ties (leftmost wins), so rounding can't pick
    // a visibly taller column
    if (heights[column] < heights[best] - 0.5) best = column;
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
  const columnCount = Math.max(1, availableColumns);
  const heightOf = (frame: MasonryFrame) =>
    frame.width > 0 ? (columnWidth * frame.height) / frame.width : 0;

  const kept = new Map<string, number>();
  if (previous && previous.columnCount === columnCount) {
    for (const frame of frames) {
      const column = previous.columns.get(frame.key);
      if (column !== undefined) kept.set(frame.key, column);
    }
  }

  // Each column's height from kept frames not yet walked. A new frame goes to
  // the column that's shortest once those are counted too, so frames inserted
  // above kept ones (an upload at the top) balance against where each column
  // ends up — for appended frames it's zero and this is plain shortest-column
  const pendingKept = new Array<number>(columnCount).fill(0);
  for (const frame of frames) {
    const column = kept.get(frame.key);
    if (column !== undefined) pendingKept[column] += heightOf(frame) + gap;
  }

  const running = new Array<number>(columnCount).fill(0);
  const placed: Omit<MasonryPlacement, "x">[] = [];
  const columns = new Map<string, number>();
  for (const frame of frames) {
    const height = heightOf(frame);
    let column = kept.get(frame.key);
    if (column === undefined) {
      column = shortestColumn(running.map((h, i) => h + pendingKept[i]));
    } else {
      pendingKept[column] -= height + gap;
    }
    placed.push({
      key: frame.key,
      column,
      y: running[column],
      width: columnWidth,
      height,
    });
    columns.set(frame.key, column);
    running[column] += height + gap;
  }

  // Fewer frames than columns: centre the occupied columns at the normal
  // column width (not stretched to fill the row). Columns keep their indices,
  // so a frame joining an empty column just slides the group over rather
  // than relaying out everything
  let firstUsed = columnCount;
  let lastUsed = -1;
  for (const { column } of placed) {
    firstUsed = Math.min(firstUsed, column);
    lastUsed = Math.max(lastUsed, column);
  }
  const usedSpan =
    lastUsed >= firstUsed ? lastUsed - firstUsed + 1 : columnCount;
  const offsetColumns =
    (columnCount - usedSpan) / 2 - (lastUsed >= 0 ? firstUsed : 0);
  const placements = placed.map((placement) => ({
    ...placement,
    x: (offsetColumns + placement.column) * (columnWidth + gap),
  }));

  const tallest = Math.max(0, ...running);
  return {
    placements,
    height: tallest > 0 ? tallest - gap : 0,
    columnCount,
    columns,
  };
}
