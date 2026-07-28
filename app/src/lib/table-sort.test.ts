import { describe, expect, it } from "vitest";
import {
  buildSortQuery,
  nextSortState,
  parseSortParams,
  type SortState,
} from "./table-sort";

const COLUMNS = ["user", "items", "joined"] as const;

describe("parseSortParams", () => {
  it("returns the column and direction when both are valid", () => {
    expect(parseSortParams({ sort: "items", dir: "desc" }, COLUMNS)).toEqual({
      column: "items",
      direction: "desc",
    });
  });

  it("defaults direction to asc when missing or invalid", () => {
    expect(parseSortParams({ sort: "items" }, COLUMNS).direction).toBe("asc");
    expect(
      parseSortParams({ sort: "items", dir: "sideways" }, COLUMNS).direction,
    ).toBe("asc");
  });

  it("ignores columns not in the allowlist", () => {
    expect(
      parseSortParams({ sort: "password", dir: "asc" }, COLUMNS).column,
    ).toBeNull();
  });

  it("returns a null column when no sort param is present", () => {
    expect(parseSortParams({}, COLUMNS).column).toBeNull();
  });
});

describe("nextSortState", () => {
  it("starts a freshly-clicked column at asc", () => {
    const current: SortState = { column: null, direction: "asc" };
    expect(nextSortState(current, "items")).toEqual({
      column: "items",
      direction: "asc",
    });
  });

  it("switches a different active column to asc", () => {
    const current: SortState = { column: "user", direction: "desc" };
    expect(nextSortState(current, "items")).toEqual({
      column: "items",
      direction: "asc",
    });
  });

  it("cycles asc → desc on the active column", () => {
    const current: SortState = { column: "items", direction: "asc" };
    expect(nextSortState(current, "items")).toEqual({
      column: "items",
      direction: "desc",
    });
  });

  it("cycles desc → unset on the active column", () => {
    const current: SortState = { column: "items", direction: "desc" };
    expect(nextSortState(current, "items")).toEqual({
      column: null,
      direction: "asc",
    });
  });
});

describe("buildSortQuery", () => {
  it("sets sort and dir for an active column", () => {
    const result = buildSortQuery(new URLSearchParams(), {
      column: "items",
      direction: "desc",
    });
    expect(result.get("sort")).toBe("items");
    expect(result.get("dir")).toBe("desc");
  });

  it("removes sort and dir when unset", () => {
    const result = buildSortQuery(new URLSearchParams("sort=items&dir=desc"), {
      column: null,
      direction: "asc",
    });
    expect(result.has("sort")).toBe(false);
    expect(result.has("dir")).toBe(false);
  });

  it("preserves other params but resets page", () => {
    const result = buildSortQuery(
      new URLSearchParams("search=ada&page=3&sort=user&dir=asc"),
      { column: "items", direction: "asc" },
    );
    expect(result.get("search")).toBe("ada");
    expect(result.has("page")).toBe(false);
    expect(result.get("sort")).toBe("items");
  });
});
