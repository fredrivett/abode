import { describe, expect, it } from "vitest";
import {
  coverOverhang,
  coverSlices,
  pageSlices,
  planeOutline,
} from "./cover-perspective";

const size = { width: 300, height: 450 };

describe("coverSlices", () => {
  const slices = coverSlices(size);

  it("covers the whole flat cover, in order", () => {
    expect(slices[0].from).toBe(0);
    const last = slices[slices.length - 1];
    expect(last.from + last.width).toBe(size.width);
  });

  it("starts at the spine, unscaled", () => {
    expect(slices[0].quad[0]).toEqual([0, 0]);
    expect(slices[0].quad[3][1]).toBe(size.height);
  });

  it("turns toward the viewer: narrower across, taller toward the fore-edge", () => {
    const [, topRight, bottomRight] = planeOutline(slices);
    // rotateY(-28deg) under 470cqw perspective lands the fore-edge ~92.5% across
    expect(topRight[0] / size.width).toBeCloseTo(0.9255, 3);
    expect(topRight[1]).toBeLessThan(0);
    expect(bottomRight[1]).toBeGreaterThan(size.height);
    expect(slices[slices.length - 1].scaleY).toBeGreaterThan(slices[0].scaleY);
  });

  it("joins each slice to the next with no gap", () => {
    for (let i = 1; i < slices.length; i++) {
      expect(slices[i].quad[0][0]).toBeCloseTo(slices[i - 1].quad[1][0], 9);
    }
  });

  it("maps each slice's flat column onto its outline", () => {
    for (const slice of slices) {
      // The column's left edge, scaled and moved, lands on the outline
      expect(slice.left).toBeCloseTo(slice.quad[0][0], 9);
      expect(slice.left + slice.width * slice.scaleX).toBeCloseTo(
        slice.quad[1][0],
        9,
      );
    }
  });
});

describe("pageSlices", () => {
  it("recede from behind the cover, ending short of the back board's edge", () => {
    const outline = planeOutline(pageSlices(size));
    expect(outline[0][0] / size.width).toBeCloseTo(0.84, 5);
    const end = outline[1][0] / size.width;
    expect(end).toBeGreaterThan(0.9255);
    expect(end).toBeLessThan(1);
    // Shrinking with depth
    expect(outline[1][1]).toBeGreaterThan(outline[0][1]);
  });
});

describe("coverOverhang", () => {
  it("is how far the fore-edge rises above (and below) the box", () => {
    const [, topRight] = planeOutline(coverSlices(size));
    expect(coverOverhang(size.height)).toBeCloseTo(-topRight[1], 9);
  });
});
