import { describe, expect, it } from "vitest";
import {
  createFilterId,
  type Filter,
  filtersEqual,
  parseFilterString,
  parseSearchParams,
  serializeFilter,
  serializeSearchParams,
} from "./types";

describe("filtersEqual", () => {
  const createFilter = (overrides: Partial<Filter> = {}): Filter => ({
    id: createFilterId(),
    type: "tag",
    value: "test",
    negated: false,
    ...overrides,
  });

  describe("basic equality", () => {
    it("returns true for empty arrays", () => {
      expect(filtersEqual([], [])).toBe(true);
    });

    it("returns true for identical filters", () => {
      const filter = createFilter({ value: "landscape" });
      expect(filtersEqual([filter], [filter])).toBe(true);
    });

    it("returns true for equivalent filters with different IDs", () => {
      const a = createFilter({ id: "aaa", value: "landscape" });
      const b = createFilter({ id: "bbb", value: "landscape" });
      expect(filtersEqual([a], [b])).toBe(true);
    });

    it("returns false for different lengths", () => {
      const filter = createFilter();
      expect(filtersEqual([filter], [])).toBe(false);
      expect(filtersEqual([], [filter])).toBe(false);
    });

    it("returns false for different values", () => {
      const a = createFilter({ value: "landscape" });
      const b = createFilter({ value: "portrait" });
      expect(filtersEqual([a], [b])).toBe(false);
    });

    it("returns false for different types", () => {
      const a = createFilter({ type: "tag", value: "test" });
      const b = createFilter({ type: "object", value: "test" });
      expect(filtersEqual([a], [b])).toBe(false);
    });

    it("returns false for different negated values", () => {
      const a = createFilter({ negated: false });
      const b = createFilter({ negated: true });
      expect(filtersEqual([a], [b])).toBe(false);
    });
  });

  describe("order independence", () => {
    it("returns true for same filters in different order", () => {
      const a = createFilter({ type: "tag", value: "alpha" });
      const b = createFilter({ type: "tag", value: "beta" });
      expect(filtersEqual([a, b], [b, a])).toBe(true);
    });

    it("returns true for different types in different order", () => {
      const tag = createFilter({ type: "tag", value: "landscape" });
      const obj = createFilter({ type: "object", value: "tree" });
      expect(filtersEqual([tag, obj], [obj, tag])).toBe(true);
    });
  });

  describe("date filters", () => {
    it("returns true for equivalent date filters", () => {
      const a = createFilter({
        type: "date",
        value: "2024-01-01",
        dateOperator: "after",
      });
      const b = createFilter({
        type: "date",
        value: "2024-01-01",
        dateOperator: "after",
      });
      expect(filtersEqual([a], [b])).toBe(true);
    });

    it("returns false for different date operators", () => {
      const a = createFilter({
        type: "date",
        value: "2024-01-01",
        dateOperator: "after",
      });
      const b = createFilter({
        type: "date",
        value: "2024-01-01",
        dateOperator: "before",
      });
      expect(filtersEqual([a], [b])).toBe(false);
    });

    it("returns true for equivalent date range filters", () => {
      const a = createFilter({
        type: "date",
        value: "2024-01-01",
        dateOperator: "between",
        endDate: "2024-12-31",
      });
      const b = createFilter({
        type: "date",
        value: "2024-01-01",
        dateOperator: "between",
        endDate: "2024-12-31",
      });
      expect(filtersEqual([a], [b])).toBe(true);
    });

    it("returns false for different end dates", () => {
      const a = createFilter({
        type: "date",
        value: "2024-01-01",
        dateOperator: "between",
        endDate: "2024-06-30",
      });
      const b = createFilter({
        type: "date",
        value: "2024-01-01",
        dateOperator: "between",
        endDate: "2024-12-31",
      });
      expect(filtersEqual([a], [b])).toBe(false);
    });
  });

  describe("complex scenarios", () => {
    it("handles multiple filters of same type", () => {
      const a1 = createFilter({ type: "tag", value: "a" });
      const a2 = createFilter({ type: "tag", value: "b" });
      const b1 = createFilter({ type: "tag", value: "a" });
      const b2 = createFilter({ type: "tag", value: "b" });
      expect(filtersEqual([a1, a2], [b1, b2])).toBe(true);
    });

    it("handles mixed filter types", () => {
      const tag = createFilter({ type: "tag", value: "landscape" });
      const obj = createFilter({ type: "object", value: "tree" });
      const date = createFilter({
        type: "date",
        value: "2024-01-01",
        dateOperator: "after",
      });
      const loc = createFilter({ type: "location", value: "paris" });

      const a = [tag, obj, date, loc];
      const b = [loc, date, obj, tag]; // Different order

      expect(filtersEqual(a, b)).toBe(true);
    });
  });
});

describe("parseFilterString", () => {
  it("parses basic filter", () => {
    const result = parseFilterString("@tag:landscape");
    expect(result).toEqual({
      type: "tag",
      value: "landscape",
      negated: false,
    });
  });

  it("parses negated filter", () => {
    const result = parseFilterString("-@tag:work");
    expect(result).toEqual({
      type: "tag",
      value: "work",
      negated: true,
    });
  });

  it("parses date filter with after operator", () => {
    const result = parseFilterString("@date:>2024-01-01");
    expect(result).toEqual({
      type: "date",
      value: "2024-01-01",
      negated: false,
      dateOperator: "after",
    });
  });

  it("parses date filter with before operator", () => {
    const result = parseFilterString("@date:<2024-12-31");
    expect(result).toEqual({
      type: "date",
      value: "2024-12-31",
      negated: false,
      dateOperator: "before",
    });
  });

  it("parses date range filter", () => {
    const result = parseFilterString("@date:2024-01-01..2024-12-31");
    expect(result).toEqual({
      type: "date",
      value: "2024-01-01",
      endDate: "2024-12-31",
      negated: false,
      dateOperator: "between",
    });
  });

  it("returns null for invalid filter", () => {
    expect(parseFilterString("invalid")).toBeNull();
    expect(parseFilterString("@invalid:value")).toBeNull();
  });

  it("parses partial filter (type only)", () => {
    const result = parseFilterString("@tag");
    expect(result).toEqual({
      type: "tag",
      negated: false,
    });
  });
});

describe("serializeFilter", () => {
  it("serializes basic filter", () => {
    const filter: Filter = {
      id: "1",
      type: "tag",
      value: "landscape",
      negated: false,
    };
    expect(serializeFilter(filter)).toBe("@tag:landscape");
  });

  it("serializes negated filter", () => {
    const filter: Filter = {
      id: "1",
      type: "tag",
      value: "work",
      negated: true,
    };
    expect(serializeFilter(filter)).toBe("-@tag:work");
  });

  it("serializes date filter with after operator", () => {
    const filter: Filter = {
      id: "1",
      type: "date",
      value: "2024-01-01",
      negated: false,
      dateOperator: "after",
    };
    expect(serializeFilter(filter)).toBe("@date:>2024-01-01");
  });

  it("serializes date filter with before operator", () => {
    const filter: Filter = {
      id: "1",
      type: "date",
      value: "2024-12-31",
      negated: false,
      dateOperator: "before",
    };
    expect(serializeFilter(filter)).toBe("@date:<2024-12-31");
  });

  it("serializes date range filter", () => {
    const filter: Filter = {
      id: "1",
      type: "date",
      value: "2024-01-01",
      endDate: "2024-12-31",
      negated: false,
      dateOperator: "between",
    };
    expect(serializeFilter(filter)).toBe("@date:2024-01-01..2024-12-31");
  });
});

describe("parseSearchParams and serializeSearchParams", () => {
  it("round-trips basic search state", () => {
    const params = new URLSearchParams("q=hello&tag=landscape");
    const state = parseSearchParams(params);

    expect(state.query).toBe("hello");
    expect(state.filters).toHaveLength(1);
    expect(state.filters[0].type).toBe("tag");
    expect(state.filters[0].value).toBe("landscape");

    const serialized = serializeSearchParams(state);
    expect(serialized.get("q")).toBe("hello");
    expect(serialized.get("tag")).toBe("landscape");
  });

  it("handles negated filters", () => {
    const params = new URLSearchParams("tag=!work");
    const state = parseSearchParams(params);

    expect(state.filters[0].negated).toBe(true);
    expect(state.filters[0].value).toBe("work");

    const serialized = serializeSearchParams(state);
    expect(serialized.get("tag")).toBe("!work");
  });

  it("handles multiple filters of same type", () => {
    const params = new URLSearchParams("tag=a&tag=b");
    const state = parseSearchParams(params);

    expect(state.filters).toHaveLength(2);
    expect(state.filters.map((f) => f.value).sort()).toEqual(["a", "b"]);
  });
});
