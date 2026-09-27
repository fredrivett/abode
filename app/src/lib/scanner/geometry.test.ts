import { describe, expect, it } from "vitest";
import {
  coverTransform,
  flattenedSize,
  isQuad,
  maxCornerDistance,
  type Quad,
  quadArea,
  quadBounds,
  scaleQuad,
  smoothQuad,
} from "./geometry";

const rect = ({
  x,
  y,
  width,
  height,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Quad => ({
  topLeft: { x, y },
  topRight: { x: x + width, y },
  bottomRight: { x: x + width, y: y + height },
  bottomLeft: { x, y: y + height },
});

describe("quadArea", () => {
  it("computes a rectangle's area", () => {
    expect(quadArea(rect({ x: 10, y: 10, width: 30, height: 20 }))).toBe(600);
  });

  it("is orientation independent", () => {
    const quad = rect({ x: 0, y: 0, width: 4, height: 5 });
    const reversed: Quad = {
      topLeft: quad.topLeft,
      topRight: quad.bottomLeft,
      bottomRight: quad.bottomRight,
      bottomLeft: quad.topRight,
    };
    expect(quadArea(reversed)).toBe(20);
  });
});

describe("maxCornerDistance", () => {
  it("returns the largest single-corner movement", () => {
    const from = rect({ x: 0, y: 0, width: 10, height: 10 });
    const to: Quad = { ...from, bottomRight: { x: 13, y: 14 } };
    expect(maxCornerDistance({ from, to })).toBe(5);
  });
});

describe("scaleQuad / quadBounds", () => {
  it("scales every corner and reports the bounding box", () => {
    const quad = scaleQuad(rect({ x: 1, y: 2, width: 3, height: 4 }), 2);
    expect(quadBounds(quad)).toEqual({ x: 2, y: 4, width: 6, height: 8 });
  });
});

describe("flattenedSize", () => {
  it("uses the longer of each pair of opposite sides", () => {
    const trapezoid: Quad = {
      topLeft: { x: 20, y: 0 },
      topRight: { x: 80, y: 0 },
      bottomRight: { x: 100, y: 200 },
      bottomLeft: { x: 0, y: 200 },
    };
    const size = flattenedSize({ quad: trapezoid, maxDimension: 10_000 });
    expect(size.width).toBe(100);
    expect(size.height).toBe(Math.round(Math.hypot(20, 200)));
  });

  it("caps the long edge, keeping the aspect ratio", () => {
    const quad = rect({ x: 0, y: 0, width: 3000, height: 4000 });
    expect(flattenedSize({ quad, maxDimension: 2000 })).toEqual({
      width: 1500,
      height: 2000,
    });
  });
});

describe("flattenedSize minimum", () => {
  it("never returns a side under 2px, so the result can always be warped", () => {
    const sliver: Quad = rect({ x: 0, y: 0, width: 0.2, height: 50 });
    expect(flattenedSize({ quad: sliver, maxDimension: 100 }).width).toBe(2);
  });
});

describe("coverTransform", () => {
  it("scales to fill and centre-crops the overflowing axis", () => {
    // 4:3 landscape source shown in a 1:1 view — width overflows
    const map = coverTransform({
      source: { width: 400, height: 300 },
      view: { width: 150, height: 150 },
    });
    expect(map({ x: 0, y: 0 })).toEqual({ x: -25, y: 0 });
    expect(map({ x: 200, y: 150 })).toEqual({ x: 75, y: 75 });
    expect(map({ x: 400, y: 300 })).toEqual({ x: 175, y: 150 });
  });
});

describe("smoothQuad", () => {
  it("moves each corner alpha of the way to the new sample", () => {
    const previous = rect({ x: 0, y: 0, width: 10, height: 10 });
    const next = rect({ x: 10, y: 20, width: 10, height: 10 });
    expect(smoothQuad({ previous, next, alpha: 0.5 }).topLeft).toEqual({
      x: 5,
      y: 10,
    });
    expect(smoothQuad({ previous, next, alpha: 1 })).toEqual(next);
  });
});

describe("isQuad", () => {
  it("accepts a quad with finite corners", () => {
    expect(isQuad(rect({ x: 0, y: 0, width: 1, height: 1 }))).toBe(true);
  });

  it.each([
    null,
    "quad",
    { topLeft: { x: 0, y: 0 } },
    {
      ...rect({ x: 0, y: 0, width: 1, height: 1 }),
      topRight: { x: NaN, y: 0 },
    },
  ])("rejects %j", (value) => {
    expect(isQuad(value)).toBe(false);
  });
});
