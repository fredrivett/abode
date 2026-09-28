import { describe, expect, it } from "vitest";
import { documentPageCount } from "./document-pages";

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
