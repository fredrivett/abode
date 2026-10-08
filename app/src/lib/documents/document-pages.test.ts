import { describe, expect, it } from "vitest";
import { documentOcrSkippedPages, documentPageCount } from "./document-pages";

describe("documentPageCount", () => {
  it("reads the page count from a document's meta", () => {
    expect(documentPageCount({ pageCount: 3, type: "image/jpeg" })).toBe(3);
  });

  it.each([
    null,
    "3",
    {},
    { pageCount: "3" },
    { pageCount: 0 },
    { pageCount: 1.5 },
  ])("is null for %j", (meta) => {
    expect(documentPageCount(meta)).toBeNull();
  });
});

describe("documentOcrSkippedPages", () => {
  it("reads the unsearchable page count from a document's meta", () => {
    expect(
      documentOcrSkippedPages({ pageCount: 40, ocrSkippedPages: 10 }),
    ).toBe(10);
  });

  it.each([null, {}, { ocrSkippedPages: "3" }, { ocrSkippedPages: -1 }])(
    "is 0 for %j",
    (meta) => {
      expect(documentOcrSkippedPages(meta)).toBe(0);
    },
  );
});
