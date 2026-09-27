import { describe, expect, it } from "vitest";
import { pagesReducer, previewKey, type ScanPage } from "./pages";

const page = (id: string, overrides: Partial<ScanPage> = {}): ScanPage => ({
  id,
  source: new Blob([id]),
  quad: null,
  rotation: 0,
  filter: "bw",
  ...overrides,
});

const ids = (pages: ScanPage[]) => pages.map((p) => p.id);

describe("pagesReducer", () => {
  it("adds pages at the end", () => {
    const pages = pagesReducer([page("a")], { type: "add", page: page("b") });
    expect(ids(pages)).toEqual(["a", "b"]);
  });

  it("replaces a page in place (retake)", () => {
    const retaken = page("c");
    const pages = pagesReducer([page("a"), page("b")], {
      type: "replace",
      id: "a",
      page: retaken,
    });
    expect(ids(pages)).toEqual(["c", "b"]);
  });

  it("removes a page", () => {
    const pages = pagesReducer([page("a"), page("b")], {
      type: "remove",
      id: "a",
    });
    expect(ids(pages)).toEqual(["b"]);
  });

  it.each([
    { to: 0, expected: ["c", "a", "b"] },
    { to: 1, expected: ["a", "c", "b"] },
    { to: 9, expected: ["a", "b", "c"] },
  ])("moves a page to index $to", ({ to, expected }) => {
    const pages = pagesReducer([page("a"), page("b"), page("c")], {
      type: "move",
      id: "c",
      to,
    });
    expect(ids(pages)).toEqual(expected);
  });

  it("ignores moves of unknown pages", () => {
    const pages = [page("a")];
    expect(pagesReducer(pages, { type: "move", id: "x", to: 0 })).toBe(pages);
  });

  it("rotates clockwise, wrapping after 270°", () => {
    let pages = [page("a", { rotation: 180 })];
    pages = pagesReducer(pages, { type: "rotate", id: "a" });
    expect(pages[0].rotation).toBe(270);
    pages = pagesReducer(pages, { type: "rotate", id: "a" });
    expect(pages[0].rotation).toBe(0);
  });

  it("sets the filter of one page only", () => {
    const pages = pagesReducer([page("a"), page("b")], {
      type: "set-filter",
      id: "b",
      filter: "grey",
    });
    expect(pages.map((p) => p.filter)).toEqual(["bw", "grey"]);
  });
});

describe("previewKey", () => {
  it("changes when the rotation or filter changes", () => {
    const base = page("a");
    const keys = new Set([
      previewKey({ page: base }),
      previewKey({ page: { ...base, rotation: 90 } }),
      previewKey({ page: base, filter: "original" }),
    ]);
    expect(keys.size).toBe(3);
  });
});
