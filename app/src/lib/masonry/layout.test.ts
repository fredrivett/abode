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

  it("puts a frame inserted at the top into the shortest column, moving only that column", () => {
    const frames = [tall("a"), square("b"), square("c"), square("d")];
    const before = layoutMasonry({ frames, ...GEOMETRY });
    const after = layoutMasonry({
      frames: [square("new"), ...frames],
      ...GEOMETRY,
      previous: before,
    });
    // Column 2 (just c) was shortest overall
    expect(positions(after).new).toEqual([2, 0]);
    expect(positions(after)).toMatchObject({
      a: [0, 0],
      b: [1, 0],
      d: [1, 110],
      c: [2, 110],
    });
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
    expect(layout.columnCount).toBe(2);
    // Two unused columns (2 × 110px) split either side
    expect(layout.placements.map((p) => p.x)).toEqual([110, 220]);
    expect(layout.placements[0].width).toBe(100);
  });

  it("handles no frames", () => {
    expect(layoutMasonry({ frames: [], ...GEOMETRY })).toMatchObject({
      placements: [],
      height: 0,
    });
  });
});
