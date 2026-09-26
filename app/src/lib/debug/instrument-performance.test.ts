import { describe, expect, it } from "vitest";
import {
  describeLayoutShift,
  describeLongFrame,
  describeNode,
  SLOW_FRAME_MS,
} from "./instrument-performance";

describe("describeNode", () => {
  it("names nodes inside a grid item by item id", () => {
    document.body.innerHTML =
      '<div data-grid-item="item-1"><img class="cover rounded" /></div>';
    expect(describeNode(document.querySelector("img"))).toBe(
      "grid-item:item-1",
    );
  });

  it("falls back to tag and classes, noting a dialog ancestor", () => {
    document.body.innerHTML =
      '<div role="dialog"><p class="a b c d">x</p></div><span class="z"></span>';
    expect(describeNode(document.querySelector("p"))).toBe("dialog > p.a.b.c");
    expect(describeNode(document.querySelector("span"))).toBe("span.z");
    expect(describeNode(null)).toBe("(detached)");
  });
});

describe("describeLayoutShift", () => {
  it("summarises score, source nodes, and rects", () => {
    document.body.innerHTML = '<div data-grid-item="item-9"></div>';
    const node = document.querySelector("div");
    const result = describeLayoutShift({
      value: 0.123456,
      hadRecentInput: false,
      sources: [{ node, currentRect: { x: 1, y: 2, width: 3, height: 4 } }],
    });
    expect(result).toEqual({
      data: { score: 0.1235, nodes: ["grid-item:item-9"] },
      rects: [{ x: 1, y: 2, width: 3, height: 4 }],
    });
  });

  it("skips shifts made up only of the debug panel's own nodes", () => {
    document.body.innerHTML =
      '<div data-debug-panel><button class="chip">grid 3</button></div>';
    expect(
      describeLayoutShift({
        value: 0.01,
        sources: [{ node: document.querySelector("button") }],
      }),
    ).toBeNull();
  });

  it("skips shifts caused by recent input and malformed entries", () => {
    expect(
      describeLayoutShift({ value: 0.2, hadRecentInput: true, sources: [] }),
    ).toBeNull();
    expect(describeLayoutShift({})).toBeNull();
  });
});

describe("describeLongFrame", () => {
  it("ignores frames under the threshold", () => {
    expect(describeLongFrame({ duration: SLOW_FRAME_MS - 1 })).toBeNull();
  });

  it("reports duration, blocking time, and the heaviest scripts", () => {
    expect(
      describeLongFrame({
        duration: 180.4,
        blockingDuration: 120.2,
        scripts: [
          { invoker: "a", duration: 10 },
          { invoker: "b", duration: 90 },
          { invoker: "c", duration: 40 },
          { invoker: "d", duration: 5 },
        ],
      }),
    ).toEqual({
      duration: 180,
      blocking: 120,
      scripts: ["b (90ms)", "c (40ms)", "a (10ms)"],
    });
  });
});
