import { describe, expect, it } from "vitest";
import {
  applyScanFilter,
  blackAndWhite,
  greyscale,
  isScanFilter,
  luminanceQuantile,
} from "./filters";
import { createPixels, type Pixels } from "./warp";

const SIZE = 200;

/**
 * A synthetic "photographed page": paper lit unevenly (bright on the left,
 * in shadow on the right) with a band of ink across the middle rows.
 */
function photographedPage({ inkContrast }: { inkContrast: number }): Pixels {
  const pixels = createPixels({ width: SIZE, height: SIZE });
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const paper = 230 - (x / SIZE) * 110; // 230 → 120 across the page
      const isInk = y >= 95 && y < 100 && x % 20 < 14;
      const v = isInk ? paper * (1 - inkContrast) : paper;
      pixels.data.set([v, v * 0.97, v * 0.9, 255], (y * SIZE + x) * 4);
    }
  }
  return pixels;
}

const valueAt = (pixels: Pixels, x: number, y: number) =>
  pixels.data[(y * pixels.width + x) * 4];

describe("blackAndWhite", () => {
  it("turns shadowed and lit paper alike to white", () => {
    const out = blackAndWhite(photographedPage({ inkContrast: 0.7 }));
    expect(valueAt(out, 10, 20)).toBeGreaterThan(245); // lit
    expect(valueAt(out, 190, 20)).toBeGreaterThan(245); // in shadow
  });

  it("turns ink black on both lit and shadowed paper", () => {
    const out = blackAndWhite(photographedPage({ inkContrast: 0.7 }));
    expect(valueAt(out, 5, 97)).toBeLessThan(10);
    expect(valueAt(out, 185, 97)).toBeLessThan(10);
  });

  it("stretches faint pencil-like ink to black", () => {
    const out = blackAndWhite(photographedPage({ inkContrast: 0.25 }));
    expect(valueAt(out, 5, 97)).toBeLessThan(10);
    expect(valueAt(out, 10, 20)).toBeGreaterThan(245);
  });

  it("keeps a blank page white rather than amplifying grain", () => {
    const pixels = createPixels({ width: SIZE, height: SIZE });
    for (let i = 0; i < pixels.data.length; i += 4) {
      // ±3 levels of deterministic noise around paper grey
      const v = 200 + ((i * 7919) % 7) - 3;
      pixels.data.set([v, v, v, 255], i);
    }
    const out = blackAndWhite(pixels);
    let darkest = 255;
    for (let i = 0; i < out.data.length; i += 4) {
      darkest = Math.min(darkest, out.data[i]);
    }
    expect(darkest).toBeGreaterThan(200);
  });

  it("outputs opaque greyscale pixels", () => {
    const out = blackAndWhite(photographedPage({ inkContrast: 0.5 }));
    const i = (97 * SIZE + 5) * 4;
    expect(out.data[i]).toBe(out.data[i + 1]);
    expect(out.data[i + 1]).toBe(out.data[i + 2]);
    expect(out.data[i + 3]).toBe(255);
  });
});

describe("greyscale", () => {
  it("evens out lighting while keeping ink darker than paper", () => {
    const out = greyscale(photographedPage({ inkContrast: 0.5 }));
    expect(valueAt(out, 10, 20)).toBeGreaterThan(240);
    expect(valueAt(out, 190, 20)).toBeGreaterThan(240);
    expect(valueAt(out, 5, 97)).toBeLessThan(60);
  });
});

describe("greyscale tones", () => {
  it("keeps mid-tones grey instead of clipping them to black or white", () => {
    // Dark ink sets the black point; a lighter band stays in between
    const pixels = createPixels({ width: SIZE, height: SIZE });
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const v = y >= 95 && y < 100 ? 40 : y >= 150 && y < 155 ? 140 : 220;
        pixels.data.set([v, v, v, 255], (y * SIZE + x) * 4);
      }
    }
    const out = greyscale(pixels);
    const midTone = valueAt(out, 100, 152);
    expect(midTone).toBeGreaterThan(60);
    expect(midTone).toBeLessThan(200);
    // …and a hard clip at the B&W thresholds would have lost it
    expect(valueAt(blackAndWhite(pixels), 100, 152)).not.toBe(midTone);
  });
});

describe("applyScanFilter", () => {
  it("returns the original pixels untouched", () => {
    const pixels = photographedPage({ inkContrast: 0.5 });
    expect(applyScanFilter({ pixels, filter: "original" })).toBe(pixels);
  });

  it("dispatches to the named filter", () => {
    const pixels = photographedPage({ inkContrast: 0.5 });
    expect(applyScanFilter({ pixels, filter: "bw" }).data).toEqual(
      blackAndWhite(pixels).data,
    );
  });
});

describe("luminanceQuantile", () => {
  it("finds the value at the requested quantile", () => {
    const values = new Float32Array(100).map((_, i) => i / 100);
    expect(luminanceQuantile({ values, quantile: 0.1 })).toBeCloseTo(0.09, 2);
  });

  it("returns the minimum for quantile 0", () => {
    const values = new Float32Array([0.5, 0.7, 0.9]);
    expect(luminanceQuantile({ values, quantile: 0 })).toBeCloseTo(0.5, 1);
  });

  it("treats values brighter than paper as paper", () => {
    const values = new Float32Array([1.4, 1.2, 1.1]);
    expect(luminanceQuantile({ values, quantile: 0.5 })).toBeCloseTo(1, 1);
  });
});

describe("isScanFilter", () => {
  it.each(["bw", "grey", "original"])("accepts %s", (value) => {
    expect(isScanFilter(value)).toBe(true);
  });

  it.each(["colour", "", null])("rejects %j", (value) => {
    expect(isScanFilter(value)).toBe(false);
  });
});
