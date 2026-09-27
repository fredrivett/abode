import { describe, expect, it } from "vitest";
import { combinePageText } from "./combine-page-text";

describe("combinePageText", () => {
  it("joins pages in reading order regardless of input order", () => {
    expect(
      combinePageText({
        pages: [
          { position: 1, ocrText: "Second" },
          { position: 0, ocrText: "First" },
        ],
      }),
    ).toBe("First\n\nSecond");
  });

  it("skips pages without text", () => {
    expect(
      combinePageText({
        pages: [
          { position: 0, ocrText: "Cover" },
          { position: 1, ocrText: null },
          { position: 2, ocrText: "   " },
          { position: 3, ocrText: "Back" },
        ],
      }),
    ).toBe("Cover\n\nBack");
  });

  it("is null when no page has text", () => {
    expect(
      combinePageText({ pages: [{ position: 0, ocrText: null }] }),
    ).toBeNull();
  });

  it("truncates to the cap", () => {
    expect(
      combinePageText({
        pages: [{ position: 0, ocrText: "abcdefghij" }],
        maxChars: 4,
      }),
    ).toBe("abcd");
  });
});
