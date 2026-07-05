import { describe, expect, it } from "vitest";
import {
  BOOK_TILE_PADDING_FRACTION,
  DEFAULT_BOOK_COVER_RATIO,
  getBookCoverRatio,
  getBookTileFrame,
} from "./book-cover";

describe("getBookCoverRatio", () => {
  it("returns the ratio from stored cover dimensions", () => {
    expect(
      getBookCoverRatio({ coverWidth: 324, coverHeight: 500 }),
    ).toBeCloseTo(0.648);
  });

  it("falls back to 2:3 when meta is missing", () => {
    expect(getBookCoverRatio(null)).toBe(DEFAULT_BOOK_COVER_RATIO);
    expect(getBookCoverRatio(undefined)).toBe(DEFAULT_BOOK_COVER_RATIO);
    expect(getBookCoverRatio({})).toBe(DEFAULT_BOOK_COVER_RATIO);
  });

  it("falls back to 2:3 when dimensions are invalid", () => {
    expect(getBookCoverRatio({ coverWidth: 0, coverHeight: 500 })).toBe(
      DEFAULT_BOOK_COVER_RATIO,
    );
    expect(getBookCoverRatio({ coverWidth: 324, coverHeight: -1 })).toBe(
      DEFAULT_BOOK_COVER_RATIO,
    );
    expect(getBookCoverRatio({ coverWidth: "324", coverHeight: "500" })).toBe(
      DEFAULT_BOOK_COVER_RATIO,
    );
  });

  it("clamps implausibly narrow covers to 1:2", () => {
    expect(getBookCoverRatio({ coverWidth: 100, coverHeight: 1000 })).toBe(0.5);
  });

  it("clamps landscape covers to square", () => {
    expect(getBookCoverRatio({ coverWidth: 1200, coverHeight: 630 })).toBe(1);
  });
});

describe("getBookTileFrame", () => {
  it("preserves the cover ratio inside equal padding", () => {
    const { width, height } = getBookTileFrame({
      coverWidth: 318,
      coverHeight: 461,
    });
    // Inner box after removing padding from all sides must match the cover
    const pad = BOOK_TILE_PADDING_FRACTION;
    const innerRatio = (width - 2 * pad * width) / (height - 2 * pad * width);
    expect(innerRatio).toBeCloseTo(318 / 461);
  });

  it("uses the 2:3 fallback when dimensions are missing", () => {
    const { width, height } = getBookTileFrame(null);
    const pad = BOOK_TILE_PADDING_FRACTION;
    const innerRatio = (width - 2 * pad * width) / (height - 2 * pad * width);
    expect(innerRatio).toBeCloseTo(DEFAULT_BOOK_COVER_RATIO);
  });
});
