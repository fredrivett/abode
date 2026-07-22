import { describe, expect, it } from "vitest";
import {
  BOOK_TILE_PADDING_X,
  BOOK_TILE_PADDING_Y,
  DEFAULT_BOOK_COVER_RATIO,
  getBookCoverRatio,
  getBookTileFrame,
  getDominantCoverColor,
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
  it("preserves the cover ratio inside the padding", () => {
    const { width, height } = getBookTileFrame({
      coverWidth: 318,
      coverHeight: 461,
    });
    // Inner box after removing padding (fractions of width) must match cover
    const innerRatio =
      (width - 2 * BOOK_TILE_PADDING_X * width) /
      (height - 2 * BOOK_TILE_PADDING_Y * width);
    expect(innerRatio).toBeCloseTo(318 / 461);
  });

  it("uses the 2:3 fallback when dimensions are missing", () => {
    const { width, height } = getBookTileFrame(null);
    const innerRatio =
      (width - 2 * BOOK_TILE_PADDING_X * width) /
      (height - 2 * BOOK_TILE_PADDING_Y * width);
    expect(innerRatio).toBeCloseTo(DEFAULT_BOOK_COVER_RATIO);
  });
});

describe("getDominantCoverColor", () => {
  it("returns the highest-scoring color's hex", () => {
    expect(
      getDominantCoverColor([
        { hex: "#111111", name: "black", score: 0.2 },
        { hex: "#eeeeee", name: "white", score: 0.7 },
        { hex: "#ff0000", name: "red", score: 0.5 },
      ]),
    ).toBe("#eeeeee");
  });

  it("does not mutate the input order", () => {
    const colors = [
      { hex: "#111111", name: "black", score: 0.2 },
      { hex: "#eeeeee", name: "white", score: 0.7 },
    ];
    getDominantCoverColor(colors);
    expect(colors[0]?.hex).toBe("#111111");
  });

  it("treats a missing score as zero", () => {
    expect(
      getDominantCoverColor([
        { hex: "#111111", name: "black" },
        { hex: "#eeeeee", name: "white", score: 0.1 },
      ]),
    ).toBe("#eeeeee");
  });

  it("returns undefined when there are no colors", () => {
    expect(getDominantCoverColor([])).toBeUndefined();
    expect(getDominantCoverColor(null)).toBeUndefined();
    expect(getDominantCoverColor(undefined)).toBeUndefined();
  });
});
