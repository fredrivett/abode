import { describe, expect, it } from "vitest";
import {
  diffGridSnapshots,
  diffItemIds,
  type FrameBox,
  type GridSnapshot,
} from "./grid-layout-diff";

const box = (y: number, height = 100, x = 0): FrameBox => ({
  x,
  y,
  width: 200,
  height,
});
const snap = (entries: [string, FrameBox][]): GridSnapshot => new Map(entries);
const viewport = { top: 0, bottom: 800 };

describe("diffGridSnapshots", () => {
  it("reports moved frames and whether the user could see them", () => {
    const diff = diffGridSnapshots({
      prev: snap([
        ["a", box(0)],
        ["b", box(2000)],
      ]),
      next: snap([
        ["a", box(40)],
        ["b", box(2100)],
      ]),
      viewport,
    });
    expect(diff.moved).toEqual([
      { id: "a", dx: 0, dy: 40, dw: 0, dh: 0, visible: true },
      { id: "b", dx: 0, dy: 100, dw: 0, dh: 0, visible: false },
    ]);
  });

  it("counts a frame moving into view as visible", () => {
    const diff = diffGridSnapshots({
      prev: snap([["a", box(1000)]]),
      next: snap([["a", box(500)]]),
      viewport,
    });
    expect(diff.moved[0].visible).toBe(true);
  });

  it("ignores sub-pixel noise", () => {
    const diff = diffGridSnapshots({
      prev: snap([["a", box(0)]]),
      next: snap([["a", box(0.6, 100.4)]]),
      viewport,
    });
    expect(diff.moved).toEqual([]);
  });

  it("reports added and removed frames (e.g. skeletons swapped for items)", () => {
    const diff = diffGridSnapshots({
      prev: snap([
        ["a", box(0)],
        ["sk-1", box(200)],
      ]),
      next: snap([
        ["a", box(0)],
        ["item-2", box(200)],
      ]),
      viewport,
    });
    expect(diff).toEqual({ moved: [], added: ["item-2"], removed: ["sk-1"] });
  });

  it("reports resizes as moves", () => {
    const diff = diffGridSnapshots({
      prev: snap([["a", box(0, 100)]]),
      next: snap([["a", box(0, 150)]]),
      viewport,
    });
    expect(diff.moved[0]).toMatchObject({ id: "a", dh: 50 });
  });
});

describe("diffItemIds", () => {
  it("detects an appended page", () => {
    expect(
      diffItemIds({ prev: ["a", "b"], next: ["a", "b", "c", "d"] }),
    ).toEqual({ added: 2, removed: 0, reordered: false });
  });

  it("detects dropped items without calling it a reorder", () => {
    expect(diffItemIds({ prev: ["a", "b", "c"], next: ["a", "c"] })).toEqual({
      added: 0,
      removed: 1,
      reordered: false,
    });
  });

  it("detects surviving items changing order", () => {
    expect(
      diffItemIds({ prev: ["a", "b", "c"], next: ["b", "a", "c"] }),
    ).toEqual({ added: 0, removed: 0, reordered: true });
  });
});
