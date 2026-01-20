import { describe, expect, it } from "vitest";
import { parseFilterContext } from "./parse-filter-context";

describe("parseFilterContext", () => {
  describe("no filter context", () => {
    it("returns none mode for empty query", () => {
      const result = parseFilterContext("");
      expect(result).toEqual({
        mode: "none",
        filterType: null,
        searchText: "",
        prefixEnd: 0,
      });
    });

    it("returns none mode for plain text query", () => {
      const result = parseFilterContext("hello world");
      expect(result).toEqual({
        mode: "none",
        filterType: null,
        searchText: "",
        prefixEnd: 0,
      });
    });

    it("returns none mode when @ is in the middle of a word", () => {
      const result = parseFilterContext("email@example.com");
      expect(result).toEqual({
        mode: "none",
        filterType: null,
        searchText: "",
        prefixEnd: 0,
      });
    });

    it("returns none mode when filter is abandoned (space after partial)", () => {
      const result = parseFilterContext("@ta something else");
      expect(result).toEqual({
        mode: "none",
        filterType: null,
        searchText: "",
        prefixEnd: 0,
      });
    });

    it("returns none mode when filter value is abandoned (space after value)", () => {
      const result = parseFilterContext("@tag:landscape something else");
      expect(result).toEqual({
        mode: "none",
        filterType: null,
        searchText: "",
        prefixEnd: 0,
      });
    });
  });

  describe("types mode (selecting filter type)", () => {
    it("returns types mode when @ is at start of query", () => {
      const result = parseFilterContext("@");
      expect(result).toEqual({
        mode: "types",
        filterType: null,
        searchText: "",
        prefixEnd: 0,
      });
    });

    it("returns types mode when @ is after space", () => {
      const result = parseFilterContext("hello @");
      expect(result).toEqual({
        mode: "types",
        filterType: null,
        searchText: "",
        prefixEnd: 6,
      });
    });

    it("returns types mode with partial type text", () => {
      const result = parseFilterContext("@ta");
      expect(result).toEqual({
        mode: "types",
        filterType: null,
        searchText: "ta",
        prefixEnd: 0,
      });
    });

    it("returns types mode with partial type text after query", () => {
      const result = parseFilterContext("search query @ta");
      expect(result).toEqual({
        mode: "types",
        filterType: null,
        searchText: "ta",
        prefixEnd: 13,
      });
    });
  });

  describe("values mode (selecting filter value)", () => {
    it("returns values mode for tag filter", () => {
      const result = parseFilterContext("@tag:");
      expect(result).toEqual({
        mode: "values",
        filterType: "tag",
        searchText: "",
        prefixEnd: 0,
      });
    });

    it("returns values mode with partial value text", () => {
      const result = parseFilterContext("@tag:land");
      expect(result).toEqual({
        mode: "values",
        filterType: "tag",
        searchText: "land",
        prefixEnd: 0,
      });
    });

    it("returns values mode for object filter", () => {
      const result = parseFilterContext("@object:");
      expect(result).toEqual({
        mode: "values",
        filterType: "object",
        searchText: "",
        prefixEnd: 0,
      });
    });

    it("returns values mode for type filter", () => {
      const result = parseFilterContext("@type:");
      expect(result).toEqual({
        mode: "values",
        filterType: "type",
        searchText: "",
        prefixEnd: 0,
      });
    });

    it("returns values mode for color filter", () => {
      const result = parseFilterContext("@color:");
      expect(result).toEqual({
        mode: "values",
        filterType: "color",
        searchText: "",
        prefixEnd: 0,
      });
    });

    it("returns values mode for location filter", () => {
      const result = parseFilterContext("@location:");
      expect(result).toEqual({
        mode: "values",
        filterType: "location",
        searchText: "",
        prefixEnd: 0,
      });
    });

    it("returns values mode for date filter", () => {
      const result = parseFilterContext("@date:");
      expect(result).toEqual({
        mode: "values",
        filterType: "date",
        searchText: "",
        prefixEnd: 0,
      });
    });

    it("returns values mode for filter after query text", () => {
      const result = parseFilterContext("search text @tag:land");
      expect(result).toEqual({
        mode: "values",
        filterType: "tag",
        searchText: "land",
        prefixEnd: 12,
      });
    });
  });

  describe("invalid filter types", () => {
    it("returns none mode for unknown filter type with colon", () => {
      const result = parseFilterContext("@invalid:");
      expect(result).toEqual({
        mode: "none",
        filterType: null,
        searchText: "",
        prefixEnd: 0,
      });
    });

    it("returns none mode for unknown filter type with value", () => {
      const result = parseFilterContext("@unknown:value");
      expect(result).toEqual({
        mode: "none",
        filterType: null,
        searchText: "",
        prefixEnd: 0,
      });
    });
  });

  describe("edge cases", () => {
    it("handles multiple @ symbols - uses the last valid one", () => {
      // First @ is in email, second @ is a filter start
      const result = parseFilterContext("user@email.com @tag:");
      expect(result).toEqual({
        mode: "values",
        filterType: "tag",
        searchText: "",
        prefixEnd: 15,
      });
    });

    it("handles filter at end after completed filter text", () => {
      // The first filter is complete (has space after), second is active
      const result = parseFilterContext("completed @tag:");
      expect(result).toEqual({
        mode: "values",
        filterType: "tag",
        searchText: "",
        prefixEnd: 10,
      });
    });

    it("correctly calculates prefixEnd for complex queries", () => {
      const query = "some long search text @object:tre";
      const result = parseFilterContext(query);

      // prefixEnd is the index of the @ symbol
      expect(result.prefixEnd).toBe(22);
      // Slicing to prefixEnd gives us everything before the @
      expect(query.slice(0, result.prefixEnd)).toBe("some long search text ");
    });

    it("handles empty value after colon", () => {
      const result = parseFilterContext("@tag:");
      expect(result.searchText).toBe("");
      expect(result.mode).toBe("values");
    });

    it("handles @ directly after another word without space", () => {
      const result = parseFilterContext("word@tag:");
      expect(result).toEqual({
        mode: "none",
        filterType: null,
        searchText: "",
        prefixEnd: 0,
      });
    });
  });
});
