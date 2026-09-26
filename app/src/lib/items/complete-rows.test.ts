import { describe, expect, it } from "vitest";
import { completeRowFrameCount, gridColumnCount } from "./complete-rows";

describe("gridColumnCount", () => {
  it("fits as many min-width columns (plus gaps) as the container allows", () => {
    // 4 columns need 4 × 250 + 3 × 16 = 1048px
    expect(
      gridColumnCount({ containerWidth: 1047, frameWidth: 250, gap: 16 }),
    ).toBe(3);
    expect(
      gridColumnCount({ containerWidth: 1048, frameWidth: 250, gap: 16 }),
    ).toBe(4);
    expect(
      gridColumnCount({ containerWidth: 1300, frameWidth: 250, gap: 16 }),
    ).toBe(4);
  });

  it("never returns fewer than one column", () => {
    expect(
      gridColumnCount({ containerWidth: 100, frameWidth: 250, gap: 16 }),
    ).toBe(1);
  });
});

describe("completeRowFrameCount", () => {
  it("drops the partial last row while more pages are coming", () => {
    expect(
      completeRowFrameCount({ frameCount: 26, columnCount: 4, hasMore: true }),
    ).toBe(24);
    expect(
      completeRowFrameCount({ frameCount: 24, columnCount: 4, hasMore: true }),
    ).toBe(24);
  });

  it("renders everything once there's nothing more to load", () => {
    expect(
      completeRowFrameCount({ frameCount: 26, columnCount: 4, hasMore: false }),
    ).toBe(26);
  });

  it("renders everything before the columns are measured", () => {
    expect(
      completeRowFrameCount({
        frameCount: 26,
        columnCount: null,
        hasMore: true,
      }),
    ).toBe(26);
  });

  it("never hides the only (partial) row", () => {
    expect(
      completeRowFrameCount({ frameCount: 3, columnCount: 5, hasMore: true }),
    ).toBe(3);
  });
});
