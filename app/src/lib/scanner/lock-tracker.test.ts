import { describe, expect, it } from "vitest";
import type { Quad } from "./geometry";
import { createLockTracker } from "./lock-tracker";

const frame = { width: 1000, height: 1000 };

const page = (offset = 0): Quad => ({
  topLeft: { x: 200 + offset, y: 200 },
  topRight: { x: 800 + offset, y: 200 },
  bottomRight: { x: 800 + offset, y: 800 },
  bottomLeft: { x: 200 + offset, y: 800 },
});

const tinyPage: Quad = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 100, y: 0 },
  bottomRight: { x: 100, y: 100 },
  bottomLeft: { x: 0, y: 100 },
};

describe("createLockTracker", () => {
  it("is searching until a document appears", () => {
    const tracker = createLockTracker({ holdMs: 1000 });
    expect(tracker.update({ quad: null, frame, now: 0 })).toEqual({
      status: "searching",
      progress: 0,
    });
  });

  it("counts up while the document is held steady, then locks", () => {
    const tracker = createLockTracker({ holdMs: 1000 });
    expect(tracker.update({ quad: page(), frame, now: 0 })).toEqual({
      status: "steady",
      progress: 0,
    });
    expect(tracker.update({ quad: page(5), frame, now: 500 })).toEqual({
      status: "steady",
      progress: 0.5,
    });
    expect(tracker.update({ quad: page(), frame, now: 1000 })).toEqual({
      status: "locked",
      progress: 1,
    });
  });

  it("restarts the hold when the document moves beyond tolerance", () => {
    const tracker = createLockTracker({ holdMs: 1000, tolerance: 0.03 });
    tracker.update({ quad: page(), frame, now: 0 });
    tracker.update({ quad: page(), frame, now: 800 });
    // 3% of the ~1414px diagonal is ~42px
    expect(tracker.update({ quad: page(60), frame, now: 900 })).toEqual({
      status: "steady",
      progress: 0,
    });
  });

  it("measures drift from where the hold started, so slow creep resets", () => {
    const tracker = createLockTracker({ holdMs: 10_000, tolerance: 0.03 });
    tracker.update({ quad: page(0), frame, now: 0 });
    tracker.update({ quad: page(20), frame, now: 100 });
    tracker.update({ quad: page(40), frame, now: 200 });
    expect(tracker.update({ quad: page(60), frame, now: 300 }).progress).toBe(
      0,
    );
  });

  it("ignores brief detection dropouts within the grace period", () => {
    const tracker = createLockTracker({ holdMs: 1000, graceMs: 300 });
    tracker.update({ quad: page(), frame, now: 0 });
    tracker.update({ quad: page(), frame, now: 400 });
    expect(tracker.update({ quad: null, frame, now: 600 })).toEqual({
      status: "steady",
      progress: 0.4,
    });
    expect(tracker.update({ quad: page(), frame, now: 700 }).progress).toBe(
      0.7,
    );
  });

  it("resets after the document is gone longer than the grace period", () => {
    const tracker = createLockTracker({ holdMs: 1000, graceMs: 300 });
    tracker.update({ quad: page(), frame, now: 0 });
    expect(tracker.update({ quad: null, frame, now: 500 }).status).toBe(
      "searching",
    );
    expect(tracker.update({ quad: page(), frame, now: 600 }).progress).toBe(0);
  });

  it("flags documents too small to scan and doesn't count them", () => {
    const tracker = createLockTracker({ holdMs: 1000, minCoverage: 0.1 });
    tracker.update({ quad: tinyPage, frame, now: 0 });
    expect(tracker.update({ quad: tinyPage, frame, now: 900 })).toEqual({
      status: "too-small",
      progress: 0,
    });
  });

  it("starts over after reset", () => {
    const tracker = createLockTracker({ holdMs: 1000 });
    tracker.update({ quad: page(), frame, now: 0 });
    tracker.update({ quad: page(), frame, now: 1000 });
    tracker.reset();
    expect(tracker.update({ quad: page(), frame, now: 1100 }).progress).toBe(0);
  });
});
