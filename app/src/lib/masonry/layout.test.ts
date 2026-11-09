import { describe, expect, it } from "vitest";
import {
  layoutMasonry,
  type MasonryFrame,
  type MasonryLayout,
  masonryColumns,
} from "./layout";

const square = (key: string): MasonryFrame => ({ key, width: 1, height: 1 });
const tall = (key: string): MasonryFrame => ({ key, width: 1, height: 2 });

const GEOMETRY = { columnCount: 3, columnWidth: 100, gap: 10 };

function positions(layout: MasonryLayout): Record<string, [number, number]> {
  return Object.fromEntries(
    layout.placements.map((p) => [p.key, [p.column, p.y]]),
  );
}

describe("masonryColumns", () => {
  it("fits as many min-width columns (plus gaps) as the container allows", () => {
    // 4 columns need 4 × 250 + 3 × 16 = 1048px
    expect(
      masonryColumns({ containerWidth: 1047, minColumnWidth: 250, gap: 16 }),
    ).toMatchObject({ columnCount: 3 });
    expect(
      masonryColumns({ containerWidth: 1048, minColumnWidth: 250, gap: 16 }),
    ).toEqual({ columnCount: 4, columnWidth: 250 });
  });

  it("stretches columns to fill the container", () => {
    expect(
      masonryColumns({ containerWidth: 1100, minColumnWidth: 250, gap: 16 }),
    ).toEqual({ columnCount: 4, columnWidth: 263 });
  });

  it("never returns fewer than one column", () => {
    expect(
      masonryColumns({ containerWidth: 100, minColumnWidth: 250, gap: 16 }),
    ).toEqual({ columnCount: 1, columnWidth: 100 });
  });
});

describe("layoutMasonry", () => {
  it("places each frame in the shortest column, in order", () => {
    const layout = layoutMasonry({
      frames: [tall("a"), square("b"), square("c"), square("d")],
      ...GEOMETRY,
    });
    expect(positions(layout)).toEqual({
      a: [0, 0],
      b: [1, 0],
      c: [2, 0],
      // columns 1 and 2 (110px) are shorter than column 0 (210px)
      d: [1, 110],
    });
    expect(layout.placements[0]).toMatchObject({
      x: 0,
      width: 100,
      height: 200,
    });
    expect(layout.placements[3]).toMatchObject({ x: 110 });
  });

  it("uses exact heights from each frame's aspect ratio", () => {
    const layout = layoutMasonry({
      frames: [{ key: "a", width: 16, height: 9 }],
      columnCount: 1,
      columnWidth: 320,
      gap: 0,
    });
    expect(layout.placements[0].height).toBe(180);
    expect(layout.height).toBe(180);
  });

  it("reports the tallest column as the height (no trailing gap)", () => {
    const layout = layoutMasonry({
      frames: [tall("a"), square("b"), square("c")],
      ...GEOMETRY,
    });
    expect(layout.height).toBe(200);
  });

  it("never moves existing frames when more are appended", () => {
    const firstPage = [tall("a"), square("b"), square("c"), square("d")];
    const before = layoutMasonry({ frames: firstPage, ...GEOMETRY });
    const after = layoutMasonry({
      frames: [...firstPage, tall("e"), square("f"), square("g"), tall("h")],
      ...GEOMETRY,
    });
    for (const placement of before.placements) {
      expect(after.placements.find((p) => p.key === placement.key)).toEqual(
        placement,
      );
    }
  });

  it("keeps each frame's column when an earlier frame changes shape", () => {
    const frames = [square("a"), square("b"), square("c"), square("d")];
    const before = layoutMasonry({ frames, ...GEOMETRY });
    const reshaped = [tall("a"), ...frames.slice(1)];

    // Without the previous layout, d would jump to the now-shorter column 1
    expect(
      positions(layoutMasonry({ frames: reshaped, ...GEOMETRY })).d[0],
    ).toBe(1);

    const after = layoutMasonry({
      frames: reshaped,
      ...GEOMETRY,
      previous: before,
    });
    // d stays in a's column and just shifts down by a's extra height
    expect(positions(after)).toMatchObject({
      b: [1, 0],
      c: [2, 0],
      d: [0, 210],
    });
  });

  it("relays out from scratch when a frame is inserted at the top", () => {
    const frames = [tall("a"), square("b"), square("c"), square("d")];
    const before = layoutMasonry({ frames, ...GEOMETRY });
    const inserted = [square("new"), ...frames];
    const after = layoutMasonry({
      frames: inserted,
      ...GEOMETRY,
      previous: before,
    });
    // Exactly what a reload lays out: new first, the rest reflowing after it
    expect(positions(after)).toEqual(
      positions(layoutMasonry({ frames: inserted, ...GEOMETRY })),
    );
    expect(positions(after)).toEqual({
      new: [0, 0],
      a: [1, 0],
      b: [2, 0],
      c: [0, 110],
      d: [2, 110],
    });
  });

  it("puts each of several one-by-one top inserts first, next to a pinned frame", () => {
    const pinned = { ...square("pinned"), column: 0 };
    const frames = [pinned, square("a"), square("b"), square("c")];
    const first = layoutMasonry({
      frames: [pinned, square("new1"), ...frames.slice(1)],
      ...GEOMETRY,
      previous: layoutMasonry({ frames, ...GEOMETRY }),
    });
    expect(positions(first)).toMatchObject({ pinned: [0, 0], new1: [1, 0] });

    const second = layoutMasonry({
      frames: [pinned, square("new2"), square("new1"), ...frames.slice(1)],
      ...GEOMETRY,
      previous: first,
    });
    // The newest takes the first slot; the previous one moves along the row
    // instead of stacking under it in the same column
    expect(positions(second)).toMatchObject({
      pinned: [0, 0],
      new2: [1, 0],
      new1: [2, 0],
    });
  });

  it("balances frames inserted mid-list against where columns end up", () => {
    const veryTall = (key: string): MasonryFrame => ({
      key,
      width: 1,
      height: 4,
    });
    // Column 0 ends at 110px; columns 1 and 2 at 410px
    const frames = [square("a"), veryTall("b"), veryTall("c")];
    const before = layoutMasonry({ frames, ...GEOMETRY });

    const after = layoutMasonry({
      frames: [square("a"), square("new1"), square("new2"), ...frames.slice(1)],
      ...GEOMETRY,
      previous: before,
    });
    // Both belong in the short column (even after new1, it ends at 220px),
    // not in a tall column just because nothing sits at its top yet
    expect(positions(after)).toEqual({
      a: [0, 0],
      new1: [0, 110],
      new2: [0, 220],
      b: [1, 0],
      c: [2, 0],
    });
  });

  it("places a pinned frame in its column even when another is shorter", () => {
    const frames = [tall("a"), square("b"), square("c")];
    const before = layoutMasonry({ frames, ...GEOMETRY });
    // Rejoining at the top (e.g. the note composer once a search is cleared),
    // it would otherwise balance into shorter column 1 or 2
    const after = layoutMasonry({
      frames: [{ ...square("pinned"), column: 0 }, ...frames],
      ...GEOMETRY,
      previous: before,
    });
    expect(positions(after)).toEqual({
      pinned: [0, 0],
      a: [0, 110],
      b: [1, 0],
      c: [2, 0],
    });
  });

  it("keeps a pinned frame in its column over the previous layout's", () => {
    const before = layoutMasonry({
      frames: [tall("a"), square("pinned")],
      ...GEOMETRY,
    });
    expect(positions(before).pinned[0]).toBe(1);
    const after = layoutMasonry({
      frames: [{ ...square("pinned"), column: 0 }, tall("a")],
      ...GEOMETRY,
      previous: before,
    });
    expect(positions(after).pinned).toEqual([0, 0]);
  });

  it("clamps a pinned column to the columns available", () => {
    const layout = layoutMasonry({
      frames: [{ ...square("pinned"), column: 5 }],
      ...GEOMETRY,
    });
    expect(positions(layout).pinned).toEqual([2, 0]);
  });

  it("closes up only the removed frame's column", () => {
    const frames = [square("a"), square("b"), square("c"), square("d")];
    const before = layoutMasonry({ frames, ...GEOMETRY });
    const after = layoutMasonry({
      frames: frames.filter((frame) => frame.key !== "a"),
      ...GEOMETRY,
      previous: before,
    });
    expect(positions(after)).toEqual({ b: [1, 0], c: [2, 0], d: [0, 0] });
  });

  it("relays out from scratch when the column count changes", () => {
    const frames = [square("a"), square("b"), square("c"), square("d")];
    const before = layoutMasonry({ frames, ...GEOMETRY });
    const after = layoutMasonry({
      frames,
      columnCount: 2,
      columnWidth: 155,
      gap: 10,
      previous: before,
    });
    expect(positions(after)).toEqual({
      a: [0, 0],
      b: [1, 0],
      c: [0, 165],
      d: [1, 165],
    });
  });

  it("centres fewer frames than columns at the normal column width", () => {
    const layout = layoutMasonry({
      frames: [square("a"), square("b")],
      columnCount: 4,
      columnWidth: 100,
      gap: 10,
    });
    // Two unused columns (2 × 110px) split either side
    expect(layout.placements.map((p) => p.x)).toEqual([110, 220]);
    expect(layout.placements[0].width).toBe(100);
  });

  it("keeps columns when a sparse grid gains a frame — the group just slides to recentre", () => {
    const geometry = { columnCount: 4, columnWidth: 100, gap: 10 };
    const before = layoutMasonry({
      frames: [square("a"), square("b")],
      ...geometry,
    });
    const after = layoutMasonry({
      frames: [square("a"), square("b"), square("c")],
      ...geometry,
      previous: before,
    });
    // Same columns, shifted by the same amount (half a column)
    expect(after.placements.map((p) => p.column)).toEqual([0, 1, 2]);
    const shift = after.placements[0].x - before.placements[0].x;
    expect(shift).toBe(-55);
    expect(after.placements[1].x - before.placements[1].x).toBe(shift);
  });

  it("centres the occupied columns even when they don't start at the first", () => {
    const geometry = { columnCount: 4, columnWidth: 100, gap: 10 };
    const before = layoutMasonry({
      frames: [square("a"), square("b"), square("c")],
      ...geometry,
    });
    // Removing a (column 0) leaves b and c in columns 1–2
    const after = layoutMasonry({
      frames: [square("b"), square("c")],
      ...geometry,
      previous: before,
    });
    expect(after.placements.map((p) => [p.column, p.x])).toEqual([
      [1, 110],
      [2, 220],
    ]);
  });

  it("handles no frames", () => {
    expect(layoutMasonry({ frames: [], ...GEOMETRY })).toMatchObject({
      placements: [],
      height: 0,
    });
  });
});

/**
 * Random sequences of the edits the grid really sees, checking after every
 * step the invariants a user notices: cards never overlap or leave holes, and
 * an edit only moves the cards it has to. Edits mirror the app: pages append
 * (replacing their loading skeletons), new items arrive at the top (below the
 * pinned composer), any item can be deleted or change shape (processing
 * finishing, an edit), and resizing or a density change relays out.
 */
describe("layoutMasonry invariants", () => {
  const SEEDS = 300;
  const STEPS = 40;
  const GAP = 10;

  // mulberry32: small seeded PRNG so a failure replays from its seed
  function random(seed: number) {
    let state = seed;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  type Geometry = { columnCount: number; columnWidth: number; gap: number };
  type Step =
    | { type: "loadPage"; skeletons: number; added: number }
    | { type: "insertTop" }
    | { type: "delete"; key: string }
    | { type: "reshape"; key: string }
    | { type: "resize" };

  const COMPOSER = "composer";

  // Plain checks: `expect` per card per step is too slow for this many runs
  function check(ok: boolean, message: string): void {
    if (!ok) throw new Error(message);
  }
  const close = (a: number, b: number) => Math.abs(a - b) < 1e-6;

  function heightOf(frame: MasonryFrame, { columnWidth }: Geometry) {
    return (columnWidth * frame.height) / frame.width;
  }

  /** Cards packed top-down per column, in list order, inside the container */
  function checkStructure(
    frames: readonly MasonryFrame[],
    layout: MasonryLayout,
    geometry: Geometry,
  ) {
    const { columnCount, columnWidth, gap } = geometry;
    check(
      layout.placements.map((p) => p.key).join() ===
        frames.map((f) => f.key).join(),
      "placements aren't the frames in order",
    );
    const bottoms = new Array<number>(columnCount).fill(0);
    const xByColumn = new Map<number, number>();
    const containerWidth = columnCount * columnWidth + (columnCount - 1) * gap;
    layout.placements.forEach((placement, index) => {
      const frame = frames[index];
      const { key, column } = placement;
      check(column >= 0 && column < columnCount, `${key} off the grid`);
      if (frame.column !== undefined) {
        const pinned = Math.min(Math.max(0, frame.column), columnCount - 1);
        check(column === pinned, `${key} left its pinned column`);
      }
      check(placement.width === columnWidth, `${key} isn't column width`);
      check(
        close(placement.height, heightOf(frame, geometry)),
        `${key} isn't its frame's aspect`,
      );
      // Directly below the previous card in its column: no overlap, no hole
      check(close(placement.y, bottoms[column]), `${key} overlaps or gaps`);
      bottoms[column] += placement.height + gap;
      const x = xByColumn.get(column) ?? placement.x;
      check(placement.x === x, `${key} is out of line with its column`);
      xByColumn.set(column, x);
      check(
        placement.x >= -0.5 &&
          placement.x + columnWidth <= containerWidth + 0.5,
        `${key} sticks out of the container`,
      );
    });
    const tallest = Math.max(0, ...bottoms);
    check(
      close(layout.height, tallest > 0 ? tallest - gap : 0),
      "height isn't the tallest column",
    );
  }

  /** Laid out exactly like `fresh`, a layout with no history (a reload) */
  function checkSame(layout: MasonryLayout, fresh: MasonryLayout) {
    layout.placements.forEach((p, index) => {
      const q = fresh.placements[index];
      check(
        p.column === q.column && close(p.x, q.x) && close(p.y, q.y),
        `${p.key} isn't where a reload puts it`,
      );
    });
  }

  /** Every card in `keys` kept its column and its y, shifted by `dy(key)` */
  function checkKept(
    before: MasonryLayout,
    after: MasonryLayout,
    keys: Iterable<string>,
    dy: (key: string) => number = () => 0,
  ) {
    const was = new Map(before.placements.map((p) => [p.key, p]));
    const now = new Map(after.placements.map((p) => [p.key, p]));
    for (const key of keys) {
      const [a, b] = [was.get(key), now.get(key)];
      if (!a || !b) throw new Error(`${key} missing`);
      check(b.column === a.column, `${key} changed column`);
      check(close(b.y, a.y + dy(key)), `${key} moved ${b.y - a.y - dy(key)}px`);
    }
  }

  /** Cards after `key` in its column move by `delta`; nothing else moves */
  function checkColumnShift(
    before: MasonryLayout,
    after: MasonryLayout,
    key: string,
    delta: number,
  ) {
    const index = before.placements.findIndex((p) => p.key === key);
    const { column } = before.placements[index];
    const below = new Set(
      before.placements
        .slice(index + 1)
        .filter((p) => p.column === column)
        .map((p) => p.key),
    );
    checkKept(
      before,
      after,
      after.placements.map((p) => p.key).filter((k) => k !== key),
      (k) => (below.has(k) ? delta : 0),
    );
  }

  function run(seed: number) {
    const rand = random(seed);
    const pick = <T>(values: readonly T[]) =>
      values[Math.floor(rand() * values.length)];
    let nextId = 0;
    const frame = (prefix = "i"): MasonryFrame => ({
      key: `${prefix}${nextId++}`,
      width: 1,
      // Short text cards to tall portraits
      height: 0.3 + rand() * 2.7,
    });
    const randomGeometry = (): Geometry => ({
      ...masonryColumns({
        containerWidth: 200 + rand() * 1400,
        minColumnWidth: pick([120, 180, 240, 320]),
        gap: GAP,
      }),
      gap: GAP,
    });

    let geometry = randomGeometry();
    const hasComposer = rand() < 0.5;
    let frames: MasonryFrame[] = [
      ...(hasComposer
        ? [{ key: COMPOSER, width: 1, height: 1, column: 0 }]
        : []),
      ...Array.from({ length: Math.floor(rand() * 20) }, () => frame()),
    ];
    let layout = layoutMasonry({ frames, ...geometry });
    const history: string[] = [];
    checkStructure(frames, layout, geometry);

    for (let step = 0; step < STEPS; step++) {
      const items = frames.filter((f) => f.column === undefined);
      const roll = rand();
      const action: Step =
        roll < 0.25
          ? {
              type: "loadPage",
              skeletons: Math.floor(rand() * 6),
              added: Math.floor(rand() * 12),
            }
          : roll < 0.45
            ? { type: "insertTop" }
            : roll < 0.65 && items.length > 0
              ? { type: "delete", key: pick(items).key }
              : roll < 0.9 && items.length > 0
                ? { type: "reshape", key: pick(items).key }
                : { type: "resize" };
      history.push(JSON.stringify(action));

      try {
        const before = layout;
        if (action.type === "loadPage") {
          // Skeletons tease the page, then the page replaces them
          const skeletons = Array.from({ length: action.skeletons }, () =>
            frame("s"),
          );
          const withSkeletons = [...frames, ...skeletons];
          const teased = layoutMasonry({
            frames: withSkeletons,
            ...geometry,
            previous: before,
          });
          checkStructure(withSkeletons, teased, geometry);
          checkKept(before, teased, before.columns.keys());
          const added = Array.from({ length: action.added }, () => frame());
          frames = [...frames, ...added];
          layout = layoutMasonry({ frames, ...geometry, previous: teased });
          checkStructure(frames, layout, geometry);
          checkKept(before, layout, before.columns.keys());
          // Each new card went into the shortest column at its turn
          const bottoms = new Array<number>(geometry.columnCount).fill(0);
          for (const placement of layout.placements) {
            if (added.some((f) => f.key === placement.key)) {
              check(
                placement.y <= Math.min(...bottoms) + 0.5,
                `${placement.key} skipped a shorter column`,
              );
            }
            bottoms[placement.column] += placement.height + GAP;
          }
        } else if (action.type === "insertTop") {
          const at = hasComposer ? 1 : 0;
          frames = [...frames.slice(0, at), frame(), ...frames.slice(at)];
          layout = layoutMasonry({ frames, ...geometry, previous: before });
          checkStructure(frames, layout, geometry);
          // Lands where a reload would put it
          checkSame(layout, layoutMasonry({ frames, ...geometry }));
        } else if (action.type === "delete") {
          const removed = before.placements.find((p) => p.key === action.key);
          frames = frames.filter((f) => f.key !== action.key);
          layout = layoutMasonry({ frames, ...geometry, previous: before });
          checkStructure(frames, layout, geometry);
          checkColumnShift(
            before,
            layout,
            action.key,
            -((removed?.height ?? 0) + GAP),
          );
        } else if (action.type === "reshape") {
          const old = frames.find((f) => f.key === action.key);
          const reshaped = {
            ...(old as MasonryFrame),
            height: 0.3 + rand() * 2.7,
          };
          frames = frames.map((f) => (f.key === action.key ? reshaped : f));
          layout = layoutMasonry({ frames, ...geometry, previous: before });
          checkStructure(frames, layout, geometry);
          checkColumnShift(
            before,
            layout,
            action.key,
            heightOf(reshaped, geometry) -
              heightOf(old as MasonryFrame, geometry),
          );
        } else {
          const resized = randomGeometry();
          layout = layoutMasonry({ frames, ...resized, previous: before });
          checkStructure(frames, layout, resized);
          // A new column count reflows like a reload; the same count keeps columns
          if (resized.columnCount !== geometry.columnCount) {
            checkSame(layout, layoutMasonry({ frames, ...resized }));
          } else {
            // Heights scale with the column width, so only columns hold
            for (const [key, column] of before.columns) {
              check(
                layout.columns.get(key) === column,
                `${key} changed column`,
              );
            }
          }
          geometry = resized;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `seed ${seed}, after:\n  ${history.join("\n  ")}\n${message}`,
        );
      }
    }
  }

  it("holds across random sequences of real grid edits", () => {
    for (let seed = 1; seed <= SEEDS; seed++) run(seed);
  });
});
