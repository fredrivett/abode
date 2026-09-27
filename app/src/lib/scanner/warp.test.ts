import { describe, expect, it } from "vitest";
import type { Quad } from "./geometry";
import {
  createPixels,
  homography,
  type Pixels,
  rotatePixels,
  warpPerspective,
} from "./warp";

function fill(
  pixels: Pixels,
  colour: (x: number, y: number) => [number, number, number],
): Pixels {
  for (let y = 0; y < pixels.height; y++) {
    for (let x = 0; x < pixels.width; x++) {
      const i = (y * pixels.width + x) * 4;
      const [r, g, b] = colour(x, y);
      pixels.data.set([r, g, b, 255], i);
    }
  }
  return pixels;
}

function pixelAt(pixels: Pixels, x: number, y: number) {
  const i = (y * pixels.width + x) * 4;
  return Array.from(pixels.data.slice(i, i + 4));
}

describe("homography", () => {
  it("maps each source point onto its target", () => {
    const from = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const to = [
      { x: 10, y: 5 },
      { x: 50, y: 0 },
      { x: 60, y: 40 },
      { x: 0, y: 30 },
    ];
    const [a, b, c, d, e, f, g, h] = homography({ from, to });
    for (let i = 0; i < 4; i++) {
      const { x, y } = from[i];
      const w = g * x + h * y + 1;
      expect((a * x + b * y + c) / w).toBeCloseTo(to[i].x, 6);
      expect((d * x + e * y + f) / w).toBeCloseTo(to[i].y, 6);
    }
  });

  it("throws for a degenerate (collinear) quad", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ];
    expect(() =>
      homography({
        from: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
        to: line,
      }),
    ).toThrow(/Degenerate/);
  });
});

describe("warpPerspective", () => {
  it("extracts an axis-aligned region unchanged", () => {
    // Red 4x4 square at (4,4) inside a white 12x12 image
    const source = fill(createPixels({ width: 12, height: 12 }), (x, y) =>
      x >= 4 && x < 8 && y >= 4 && y < 8 ? [255, 0, 0] : [255, 255, 255],
    );
    const quad: Quad = {
      topLeft: { x: 4, y: 4 },
      topRight: { x: 7, y: 4 },
      bottomRight: { x: 7, y: 7 },
      bottomLeft: { x: 4, y: 7 },
    };
    const out = warpPerspective({
      source,
      quad,
      size: { width: 4, height: 4 },
    });
    expect(out.width).toBe(4);
    expect(out.height).toBe(4);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        expect(pixelAt(out, x, y)).toEqual([255, 0, 0, 255]);
      }
    }
  });

  it("flattens a tilted page so its corners land in the output corners", () => {
    // Each quadrant of the "page" is a different colour; the page is skewed
    const quad: Quad = {
      topLeft: { x: 30, y: 10 },
      topRight: { x: 170, y: 30 },
      bottomRight: { x: 180, y: 190 },
      bottomLeft: { x: 10, y: 170 },
    };
    const colours: Record<string, [number, number, number]> = {
      tl: [255, 0, 0],
      tr: [0, 255, 0],
      br: [0, 0, 255],
      bl: [255, 255, 0],
    };
    const cx = 95;
    const cy = 100;
    const source = fill(createPixels({ width: 200, height: 200 }), (x, y) => {
      if (y < cy) return x < cx ? colours.tl : colours.tr;
      return x < cx ? colours.bl : colours.br;
    });
    const out = warpPerspective({
      source,
      quad,
      size: { width: 50, height: 50 },
    });
    expect(pixelAt(out, 2, 2).slice(0, 3)).toEqual(colours.tl);
    expect(pixelAt(out, 47, 2).slice(0, 3)).toEqual(colours.tr);
    expect(pixelAt(out, 47, 47).slice(0, 3)).toEqual(colours.br);
    expect(pixelAt(out, 2, 47).slice(0, 3)).toEqual(colours.bl);
  });
});

describe("rotatePixels", () => {
  // 2x1 image: red then blue
  const source = () => {
    const pixels = createPixels({ width: 2, height: 1 });
    pixels.data.set([255, 0, 0, 255, 0, 0, 255, 255]);
    return pixels;
  };

  it("returns the input untouched for 0°", () => {
    const pixels = source();
    expect(rotatePixels({ source: pixels, rotation: 0 })).toBe(pixels);
  });

  it("rotates 90° clockwise", () => {
    const out = rotatePixels({ source: source(), rotation: 90 });
    expect([out.width, out.height]).toEqual([1, 2]);
    expect(pixelAt(out, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(out, 0, 1)).toEqual([0, 0, 255, 255]);
  });

  it("rotates 180°", () => {
    const out = rotatePixels({ source: source(), rotation: 180 });
    expect(pixelAt(out, 0, 0)).toEqual([0, 0, 255, 255]);
  });

  it("rotates 270° clockwise", () => {
    const out = rotatePixels({ source: source(), rotation: 270 });
    expect(pixelAt(out, 0, 0)).toEqual([0, 0, 255, 255]);
    expect(pixelAt(out, 0, 1)).toEqual([255, 0, 0, 255]);
  });
});
