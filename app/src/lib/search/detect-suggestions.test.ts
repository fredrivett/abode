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

  it("offers every facet that matches the same word, colour before tag", () => {
    // "orange" is both a known tag and colour; both offered, colour ranks first
    const out = detect("orange", { tag: ["orange"], color: ["orange"] });
    expect(out.map((s) => s.facet)).toEqual(["color", "tag"]);
  });

  it("ranks same-word matches type > colour > object > tag", () => {
    const out = detect("orange", {
      tag: ["orange"],
      object: ["orange"],
      color: ["orange"],
    });
    expect(out.map((s) => s.facet)).toEqual(["color", "object", "tag"]);
  });

  it("matches type, source and object facets", () => {
    expect(detect("book", { type: ["book"] })[0]).toMatchObject({
      facet: "type",
    });
    expect(detect("upload", { source: ["upload"] })[0]).toMatchObject({
      facet: "source",
    });
    expect(detect("tree", { object: ["tree"] })[0]).toMatchObject({
      facet: "object",
    });
  });

  it("suggests a type from a word people use for it", () => {
    const out = detect("tweets about design", { type: ["twitter"] });
    expect(out).toEqual([
      { facet: "type", value: "twitter", start: 0, end: 6 },
    ]);
    expect(detect("Photos", { type: ["image"] })[0]).toMatchObject({
      facet: "type",
      value: "image",
    });
  });

  it("only suggests a type alias for kinds the user has", () => {
    expect(detect("tweets", { type: ["image"] })).toEqual([]);
    expect(detect("tweets", {})).toEqual([]);
  });

  it("offers each owned kind for an ambiguous type word", () => {
    const both = detect("posts", { type: ["twitter", "instagram"] });
    expect(both.map((s) => s.value)).toEqual(["twitter", "instagram"]);
    const one = detect("posts", { type: ["instagram", "image"] });
    expect(one.map((s) => s.value)).toEqual(["instagram"]);
  });

  it("prefers a longer multi-word type alias over its parts", () => {
    const out = detect("blog posts", { type: ["article", "twitter"] });
    expect(out).toEqual([
      { facet: "type", value: "article", start: 0, end: 10 },
    ]);
  });

  it("offers a type alias alongside a same-named tag", () => {
    const out = detect("video", { type: ["video"], tag: ["video"] });
    expect(out.map((s) => s.facet)).toEqual(["type", "tag"]);
  });

  it("skips a type alias whose kind is already applied", () => {
    const filters: Filter[] = [
      { id: "1", type: "type", value: "twitter", negated: false },
    ];
    expect(detect("tweets", { type: ["twitter"] }, filters)).toEqual([]);
  });

  it("orders suggestions for different words by position in the query", () => {
    const out = detect("book 2026", { type: ["book"] });
    expect(out.map((s) => s.facet)).toEqual(["type", "date"]);
  });

  it("suggests the status facet for a status word", () => {
    const status = ["unread", "want_to_read", "reading", "read", "dnf"];
    expect(detect("unread", { status })[0]).toMatchObject({
      facet: "status",
      value: "unread",
    });
    expect(detect("want_to_read", { status })[0]).toMatchObject({
      facet: "status",
      value: "want_to_read",
    });
    expect(detect("dnf", { status })[0]).toMatchObject({ facet: "status" });
    // Whole-word only: "already" contains "read" but must not match.
    expect(detect("already", { status })).toEqual([]);
  });

  it("ranks status above a same-named tag", () => {
    const out = detect("read", { tag: ["read"], status: ["read"] });
    expect(out.map((s) => s.facet)).toEqual(["status", "tag"]);
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

  it("never suggests inside a double-quoted (literal) span", () => {
    expect(detect('"trip to paris"', { location: ["paris"] })).toEqual([]);
    expect(detect('"june 2026"', {})).toEqual([]);
  });

  it("treats phone-autocorrected curly quotes as a literal span too", () => {
    expect(detect("“trip to paris”", { location: ["paris"] })).toEqual([]);
    expect(detect('"trip “paris”"', { location: ["paris"] })).toEqual([]);
  });

  it("still suggests unquoted words alongside a quoted one", () => {
    const out = detect('paris "june 2026"', { location: ["paris"] });
    expect(out.map((s) => s.facet)).toEqual(["location"]);
  });
});

describe("removeSpan", () => {
  it("removes the matched span and collapses whitespace", () => {
    expect(removeSpan("paris trip", 0, 5)).toBe("trip");
    expect(removeSpan("a paris b", 2, 7)).toBe("a b");
    expect(removeSpan("paris", 0, 5)).toBe("");
  });
});
