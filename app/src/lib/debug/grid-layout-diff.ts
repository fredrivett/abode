/** Document-relative box of one grid frame, keyed by `data-grid-item`. */
export type FrameBox = { x: number; y: number; width: number; height: number };

export type GridSnapshot = Map<string, FrameBox>;

export type FrameMove = {
  id: string;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  /** Was on screen before or after the move, i.e. the user could see it jump */
  visible: boolean;
};

export type GridLayoutDiff = {
  moved: FrameMove[];
  added: string[];
  removed: string[];
};

/** Sub-pixel noise from transforms/rounding isn't a visible move */
const MOVE_THRESHOLD_PX = 1;

function overlaps(box: FrameBox, viewport: { top: number; bottom: number }) {
  return box.y < viewport.bottom && box.y + box.height > viewport.top;
}

/**
 * What changed between two settled grid layouts. Boxes are document-relative
 * so scrolling alone produces no moves; `viewport` (document-relative too)
 * decides which moves the user could actually see.
 */
export function diffGridSnapshots({
  prev,
  next,
  viewport,
}: {
  prev: GridSnapshot;
  next: GridSnapshot;
  viewport: { top: number; bottom: number };
}): GridLayoutDiff {
  const moved: FrameMove[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  for (const [id, after] of next) {
    const before = prev.get(id);
    if (!before) {
      added.push(id);
      continue;
    }
    const dx = Math.round(after.x - before.x);
    const dy = Math.round(after.y - before.y);
    const dw = Math.round(after.width - before.width);
    const dh = Math.round(after.height - before.height);
    if (
      Math.abs(dx) > MOVE_THRESHOLD_PX ||
      Math.abs(dy) > MOVE_THRESHOLD_PX ||
      Math.abs(dw) > MOVE_THRESHOLD_PX ||
      Math.abs(dh) > MOVE_THRESHOLD_PX
    ) {
      moved.push({
        id,
        dx,
        dy,
        dw,
        dh,
        visible: overlaps(before, viewport) || overlaps(after, viewport),
      });
    }
  }
  for (const id of prev.keys()) {
    if (!next.has(id)) removed.push(id);
  }
  return { moved, added, removed };
}

/** Measure every `[data-grid-item]` under root, document-relative. */
export function snapshotGrid(root: Element): GridSnapshot {
  const snapshot: GridSnapshot = new Map();
  const { scrollX, scrollY } = window;
  for (const el of root.querySelectorAll("[data-grid-item]")) {
    const id = el.getAttribute("data-grid-item");
    if (!id) continue;
    const rect = el.getBoundingClientRect();
    snapshot.set(id, {
      x: rect.x + scrollX,
      y: rect.y + scrollY,
      width: rect.width,
      height: rect.height,
    });
  }
  return snapshot;
}

/**
 * How the grid's item list changed between renders: appended pages, items
 * dropped (e.g. a refetch or search swap), and whether surviving items changed
 * relative order (which reshuffles the masonry even with no adds/removes).
 */
export function diffItemIds({
  prev,
  next,
}: {
  prev: readonly string[];
  next: readonly string[];
}): { added: number; removed: number; reordered: boolean } {
  const prevSet = new Set(prev);
  const nextSet = new Set(next);
  const added = next.filter((id) => !prevSet.has(id)).length;
  const removed = prev.filter((id) => !nextSet.has(id)).length;
  const keptPrev = prev.filter((id) => nextSet.has(id));
  const keptNext = next.filter((id) => prevSet.has(id));
  const reordered = keptPrev.some((id, index) => keptNext[index] !== id);
  return { added, removed, reordered };
}
