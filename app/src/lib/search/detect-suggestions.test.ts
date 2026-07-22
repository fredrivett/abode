import { describe, expect, it } from "vitest";
import type { FiltersResponse } from "./api";
import { detectSuggestions, removeSpan } from "./detect-suggestions";
import type { Filter } from "./types";

const NOW = new Date(Date.UTC(2026, 6, 19));

function detect(
  query: string,
  options: FiltersResponse,
  filters: Filter[] = [],
) {
  return detectSuggestions(query, options, filters, NOW);
}

describe("detectSuggestions", () => {
  it("matches a grounded facet value from the user's data", () => {
    const out = detect("paris trip", { location: ["paris"] });
    expect(out).toEqual([
      { facet: "location", value: "paris", start: 0, end: 5 },
    ]);
  });

  it("combines a grounded value and a date", () => {
    const out = detect("paris june 2026", { location: ["paris"] });
    expect(out.map((s) => [s.facet, s.value])).toEqual([
      ["location", "paris"],
      ["date", "2026-06-01"],
    ]);
    expect(out[1]).toMatchObject({
      dateOperator: "between",
      endDate: "2026-06-30",
    });
  });

  it("matches multi-word values greedily", () => {
    const out = detect("new york trip", { location: ["new york", "york"] });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ facet: "location", value: "new york" });
  });

  it("only matches whole words", () => {
    expect(detect("hundred things", { color: ["red"] })).toEqual([]);
  });

  it("is case-insensitive", () => {
    const out = detect("Paris", { location: ["paris"] });
    expect(out[0]).toMatchObject({ facet: "location", value: "paris" });
  });

  it("offers every facet that matches the same word", () => {
    // "orange" is both a known tag and colour; both should be offered
    const out = detect("orange", { tag: ["orange"], color: ["orange"] });
    expect(out.map((s) => s.facet)).toEqual(["tag", "color"]);
  });

  it("drops a match that partially overlaps a longer one", () => {
    // "york" sits inside "new york" — keep only the longer location
    const out = detect("new york", { location: ["new york", "york"] });
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe("new york");
  });

  it("skips values already applied as filters", () => {
    const filters: Filter[] = [
      { id: "1", type: "location", value: "paris", negated: false },
    ];
    expect(detect("paris trip", { location: ["paris"] }, filters)).toEqual([]);
  });

  it("returns nothing for an empty query", () => {
    expect(detect("   ", { location: ["paris"] })).toEqual([]);
  });
});

describe("removeSpan", () => {
  it("removes the matched span and collapses whitespace", () => {
    expect(removeSpan("paris trip", 0, 5)).toBe("trip");
    expect(removeSpan("a paris b", 2, 7)).toBe("a b");
    expect(removeSpan("paris", 0, 5)).toBe("");
  });
});
