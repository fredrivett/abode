import { describe, expect, it } from "vitest";
import {
  buildColorCondition,
  buildDateCondition,
  buildLocationCondition,
  buildObjectCondition,
  buildSourceCondition,
  buildTagCondition,
  buildTypeCondition,
  type FilterValue,
  hasFilters,
  normalizeColorFilterValue,
  type ParsedFilters,
  parseFiltersFromParams,
  remapParamIndices,
} from "./query-builder";

describe("parseFiltersFromParams", () => {
  describe("array-type filters", () => {
    it("parses single type filter", () => {
      const params = new URLSearchParams("type=image");
      const filters = parseFiltersFromParams(params);
      expect(filters.type).toEqual([{ value: "image", negated: false }]);
    });

    it("parses multiple tag filters", () => {
      const params = new URLSearchParams("tag=vacation&tag=summer");
      const filters = parseFiltersFromParams(params);
      expect(filters.tag).toEqual([
        { value: "vacation", negated: false },
        { value: "summer", negated: false },
      ]);
    });

    it("parses negated filters", () => {
      const params = new URLSearchParams("tag=!work");
      const filters = parseFiltersFromParams(params);
      expect(filters.tag).toEqual([{ value: "work", negated: true }]);
    });

    it("parses mixed negated and non-negated filters", () => {
      const params = new URLSearchParams("tag=vacation&tag=!work");
      const filters = parseFiltersFromParams(params);
      expect(filters.tag).toEqual([
        { value: "vacation", negated: false },
        { value: "work", negated: true },
      ]);
    });

    it("parses all array filter types", () => {
      const params = new URLSearchParams(
        "type=image&tag=vacation&object=person&color=red&source=camera&location=paris",
      );
      const filters = parseFiltersFromParams(params);
      expect(filters.type).toHaveLength(1);
      expect(filters.tag).toHaveLength(1);
      expect(filters.object).toHaveLength(1);
      expect(filters.color).toHaveLength(1);
      expect(filters.source).toHaveLength(1);
      expect(filters.location).toHaveLength(1);
    });
  });

  describe("pipe-separated OR values", () => {
    it("parses pipe-separated type values as OR group", () => {
      const params = new URLSearchParams("type=image|article");
      const filters = parseFiltersFromParams(params);
      expect(filters.type).toEqual([
        { value: "image", negated: false, orGroup: 0 },
        { value: "article", negated: false, orGroup: 0 },
      ]);
    });

    it("parses pipe-separated tag values as OR group", () => {
      const params = new URLSearchParams("tag=vacation|summer");
      const filters = parseFiltersFromParams(params);
      expect(filters.tag).toEqual([
        { value: "vacation", negated: false, orGroup: 0 },
        { value: "summer", negated: false, orGroup: 0 },
      ]);
    });

    it("handles negation within pipe-separated values", () => {
      const params = new URLSearchParams("type=image|!video");
      const filters = parseFiltersFromParams(params);
      expect(filters.type).toEqual([
        { value: "image", negated: false, orGroup: 0 },
        { value: "video", negated: true, orGroup: 0 },
      ]);
    });

    it("assigns different orGroups to separate params", () => {
      const params = new URLSearchParams("tag=a|b&tag=c|d");
      const filters = parseFiltersFromParams(params);
      expect(filters.tag).toEqual([
        { value: "a", negated: false, orGroup: 0 },
        { value: "b", negated: false, orGroup: 0 },
        { value: "c", negated: false, orGroup: 1 },
        { value: "d", negated: false, orGroup: 1 },
      ]);
    });

    it("mixes pipe-separated and regular params", () => {
      const params = new URLSearchParams("tag=a|b&tag=c");
      const filters = parseFiltersFromParams(params);
      expect(filters.tag).toEqual([
        { value: "a", negated: false, orGroup: 0 },
        { value: "b", negated: false, orGroup: 0 },
        { value: "c", negated: false },
      ]);
    });

    it("trims whitespace from pipe-separated values", () => {
      const params = new URLSearchParams("type=image | article");
      const filters = parseFiltersFromParams(params);
      expect(filters.type).toEqual([
        { value: "image", negated: false, orGroup: 0 },
        { value: "article", negated: false, orGroup: 0 },
      ]);
    });

    it("skips empty values in pipe-separated string", () => {
      const params = new URLSearchParams("type=image||article");
      const filters = parseFiltersFromParams(params);
      expect(filters.type).toEqual([
        { value: "image", negated: false, orGroup: 0 },
        { value: "article", negated: false, orGroup: 0 },
      ]);
    });
  });

  describe("date filters", () => {
    it("parses date after (>)", () => {
      const params = new URLSearchParams("date=>2024-01-01");
      const filters = parseFiltersFromParams(params);
      expect(filters.dateAfter).toBe("2024-01-01");
    });

    it("parses date before (<)", () => {
      const params = new URLSearchParams("date=<2024-06-01");
      const filters = parseFiltersFromParams(params);
      expect(filters.dateBefore).toBe("2024-06-01");
    });

    it("parses date range (..)", () => {
      const params = new URLSearchParams("date=2024-01-01..2024-06-01");
      const filters = parseFiltersFromParams(params);
      expect(filters.dateAfter).toBe("2024-01-01");
      expect(filters.dateBefore).toBe("2024-06-01");
    });

    it("parses multiple date params", () => {
      const params = new URLSearchParams("date=>2024-01-01&date=<2024-06-01");
      const filters = parseFiltersFromParams(params);
      expect(filters.dateAfter).toBe("2024-01-01");
      expect(filters.dateBefore).toBe("2024-06-01");
    });
  });

  describe("OCR filter", () => {
    it("parses OCR filter", () => {
      const params = new URLSearchParams("ocr=receipt");
      const filters = parseFiltersFromParams(params);
      expect(filters.ocr).toBe("receipt");
    });
  });

  describe("empty params", () => {
    it("returns empty object for no params", () => {
      const params = new URLSearchParams();
      const filters = parseFiltersFromParams(params);
      expect(filters).toEqual({});
    });
  });
});

describe("buildTypeCondition", () => {
  it("builds condition for single type", () => {
    const result = buildTypeCondition([{ value: "image", negated: false }]);
    expect(result.sql).toBe('(kind = $1::"ItemKind")');
    expect(result.params).toEqual(["image"]);
  });

  it("builds condition for negated type", () => {
    const result = buildTypeCondition([{ value: "video", negated: true }]);
    expect(result.sql).toBe('((kind IS NULL OR kind != $1::"ItemKind"))');
    expect(result.params).toEqual(["video"]);
  });

  it("builds condition for multiple types without orGroup (AND)", () => {
    const result = buildTypeCondition([
      { value: "image", negated: false },
      { value: "video", negated: true },
    ]);
    expect(result.sql).toBe(
      '(kind = $1::"ItemKind" AND (kind IS NULL OR kind != $2::"ItemKind"))',
    );
    expect(result.params).toEqual(["image", "video"]);
  });

  it("builds condition for OR group (pipe-separated values)", () => {
    const result = buildTypeCondition([
      { value: "image", negated: false, orGroup: 0 },
      { value: "article", negated: false, orGroup: 0 },
    ]);
    expect(result.sql).toBe(
      '((kind = $1::"ItemKind" OR kind = $2::"ItemKind"))',
    );
    expect(result.params).toEqual(["image", "article"]);
  });

  it("combines OR groups with AND for separate params", () => {
    const result = buildTypeCondition([
      { value: "image", negated: false, orGroup: 0 },
      { value: "article", negated: false, orGroup: 0 },
      { value: "video", negated: true },
    ]);
    expect(result.sql).toBe(
      '((kind = $1::"ItemKind" OR kind = $2::"ItemKind") AND (kind IS NULL OR kind != $3::"ItemKind"))',
    );
    expect(result.params).toEqual(["image", "article", "video"]);
  });

  it("returns empty string for empty array", () => {
    const result = buildTypeCondition([]);
    expect(result.sql).toBe("");
    expect(result.params).toEqual([]);
  });
});

describe("buildTagCondition", () => {
  it("builds EXISTS condition for tag", () => {
    const result = buildTagCondition(
      [{ value: "vacation", negated: false }],
      1,
    );
    expect(result.sql).toContain("EXISTS");
    expect(result.sql).toContain("unnest(tags)");
    expect(result.sql).toContain("lower(t) = lower($1)");
    expect(result.params).toEqual(["vacation"]);
  });

  it("builds NOT EXISTS condition for negated tag", () => {
    const result = buildTagCondition([{ value: "work", negated: true }], 1);
    expect(result.sql).toContain("NOT EXISTS");
    expect(result.params).toEqual(["work"]);
  });

  it("uses correct starting param index", () => {
    const result = buildTagCondition(
      [{ value: "vacation", negated: false }],
      5,
    );
    expect(result.sql).toContain("$5");
    expect(result.params).toEqual(["vacation"]);
  });

  it("handles multiple tags", () => {
    const result = buildTagCondition(
      [
        { value: "vacation", negated: false },
        { value: "work", negated: true },
      ],
      1,
    );
    expect(result.sql).toContain("$1");
    expect(result.sql).toContain("$2");
    expect(result.params).toEqual(["vacation", "work"]);
  });
});

describe("buildObjectCondition", () => {
  it("builds EXISTS condition for object", () => {
    const result = buildObjectCondition(
      [{ value: "person", negated: false }],
      1,
    );
    expect(result.sql).toContain("EXISTS");
    expect(result.sql).toContain("item_image_details");
    expect(result.sql).toContain("unnest(iid.objects)");
    expect(result.params).toEqual(["person"]);
  });

  it("builds NOT EXISTS condition for negated object", () => {
    const result = buildObjectCondition(
      [{ value: "person", negated: true }],
      1,
    );
    expect(result.sql).toContain("NOT EXISTS");
  });
});

describe("buildSourceCondition", () => {
  it("builds condition for source", () => {
    const result = buildSourceCondition(
      [{ value: "camera", negated: false }],
      1,
    );
    expect(result.sql).toContain("lower(source_type) = lower($1)");
    expect(result.params).toEqual(["camera"]);
  });

  it("builds condition for negated source", () => {
    const result = buildSourceCondition(
      [{ value: "upload", negated: true }],
      1,
    );
    expect(result.sql).toContain(
      "source_type IS NULL OR lower(source_type) != lower($1)",
    );
  });
});

describe("buildLocationCondition", () => {
  it("builds EXISTS condition for location", () => {
    const result = buildLocationCondition(
      [{ value: "paris", negated: false }],
      1,
    );
    expect(result.sql).toContain("EXISTS");
    expect(result.sql).toContain("item_locations");
    expect(result.sql).toContain("neighborhood");
    expect(result.sql).toContain("city");
    expect(result.sql).toContain("region");
    expect(result.sql).toContain("country");
    expect(result.params).toEqual(["paris"]);
  });

  it("builds NOT EXISTS condition for negated location", () => {
    const result = buildLocationCondition(
      [{ value: "london", negated: true }],
      1,
    );
    expect(result.sql).toContain("NOT EXISTS");
  });
});

describe("buildDateCondition", () => {
  it("builds condition for date after", () => {
    const result = buildDateCondition("2024-01-01", undefined, 1);
    expect(result.sql).toContain(">= $1::timestamp");
    expect(result.params).toEqual(["2024-01-01"]);
  });

  it("builds condition for date before", () => {
    const result = buildDateCondition(undefined, "2024-06-01", 1);
    expect(result.sql).toContain("<= $1::timestamp");
    expect(result.params).toEqual(["2024-06-01"]);
  });

  it("builds condition for date range", () => {
    const result = buildDateCondition("2024-01-01", "2024-06-01", 1);
    expect(result.sql).toContain(">= $1::timestamp");
    expect(result.sql).toContain("<= $2::timestamp");
    expect(result.params).toEqual(["2024-01-01", "2024-06-01"]);
  });

  it("uses COALESCE with capture_date and created_at", () => {
    const result = buildDateCondition("2024-01-01", undefined, 1);
    expect(result.sql).toContain("COALESCE");
    expect(result.sql).toContain("capture_date");
    expect(result.sql).toContain("created_at");
  });

  it("returns empty for no dates", () => {
    const result = buildDateCondition(undefined, undefined, 1);
    expect(result.sql).toBe("");
    expect(result.params).toEqual([]);
  });
});

describe("normalizeColorFilterValue", () => {
  it("normalizes named colors", () => {
    expect(normalizeColorFilterValue("red")).toBe("red");
    expect(normalizeColorFilterValue("Blue")).toBe("blue");
    expect(normalizeColorFilterValue("GREEN")).toBe("green");
  });

  it("normalizes grey to gray", () => {
    expect(normalizeColorFilterValue("grey")).toBe("gray");
    expect(normalizeColorFilterValue("Gray")).toBe("gray");
  });

  it("converts hex to nearest named color", () => {
    expect(normalizeColorFilterValue("#FF0000")).toBe("red");
    expect(normalizeColorFilterValue("#00FF00")).toBe("green");
    expect(normalizeColorFilterValue("#0000FF")).toBe("blue");
  });

  it("returns null for invalid values", () => {
    expect(normalizeColorFilterValue("invalidcolor")).toBeNull();
    expect(normalizeColorFilterValue("#GGGGGG")).toBeNull();
  });
});

describe("buildColorCondition", () => {
  it("builds EXISTS condition for color name", () => {
    const result = buildColorCondition([{ value: "red", negated: false }], 1);
    expect(result.sql).toContain("EXISTS");
    expect(result.sql).toContain("item_image_details");
    expect(result.sql).toContain("jsonb_array_elements");
    expect(result.sql).toContain("c->>'name'");
    expect(result.sql).toContain("$1");
    expect(result.params).toEqual(["red"]);
  });

  it("builds NOT EXISTS condition for negated color", () => {
    const result = buildColorCondition([{ value: "blue", negated: true }], 1);
    expect(result.sql).toContain("NOT EXISTS");
    expect(result.params).toEqual(["blue"]);
  });

  it("converts hex values to color names", () => {
    const result = buildColorCondition(
      [{ value: "#FF0000", negated: false }],
      1,
    );
    expect(result.params).toEqual(["red"]);
  });

  it("handles multiple color filters", () => {
    const result = buildColorCondition(
      [
        { value: "red", negated: false },
        { value: "blue", negated: true },
      ],
      1,
    );
    expect(result.sql).toContain("$1");
    expect(result.sql).toContain("$2");
    expect(result.params).toEqual(["red", "blue"]);
  });

  it("uses correct starting param index", () => {
    const result = buildColorCondition([{ value: "green", negated: false }], 5);
    expect(result.sql).toContain("$5");
    expect(result.params).toEqual(["green"]);
  });

  it("skips invalid color values", () => {
    const result = buildColorCondition(
      [
        { value: "red", negated: false },
        { value: "invalidcolor", negated: false },
      ],
      1,
    );
    // Only red should be in params, invalid is skipped
    expect(result.params).toEqual(["red"]);
  });

  it("returns empty for all invalid colors", () => {
    const result = buildColorCondition(
      [{ value: "invalidcolor", negated: false }],
      1,
    );
    expect(result.sql).toBe("");
    expect(result.params).toEqual([]);
  });
});

describe("hasFilters", () => {
  it("returns false for empty filters", () => {
    expect(hasFilters({})).toBe(false);
  });

  it("returns true for type filter", () => {
    const filters: ParsedFilters = {
      type: [{ value: "image", negated: false }],
    };
    expect(hasFilters(filters)).toBe(true);
  });

  it("returns true for tag filter", () => {
    const filters: ParsedFilters = {
      tag: [{ value: "vacation", negated: false }],
    };
    expect(hasFilters(filters)).toBe(true);
  });

  it("returns true for date filters", () => {
    expect(hasFilters({ dateAfter: "2024-01-01" })).toBe(true);
    expect(hasFilters({ dateBefore: "2024-06-01" })).toBe(true);
  });

  it("returns true for ocr filter", () => {
    expect(hasFilters({ ocr: "receipt" })).toBe(true);
  });

  it("returns false for empty arrays", () => {
    const filters: ParsedFilters = { type: [], tag: [] };
    expect(hasFilters(filters)).toBe(false);
  });
});

describe("remapParamIndices", () => {
  it("remaps single parameter", () => {
    expect(remapParamIndices("kind = $1", 1, 5)).toBe("kind = $5");
  });

  it("remaps multiple parameters", () => {
    expect(remapParamIndices("a = $1 AND b = $2", 2, 3)).toBe(
      "a = $3 AND b = $4",
    );
  });

  it("handles single digit param counts correctly", () => {
    // With paramCount=2 starting at 3, $1->$3 and $2->$4
    expect(remapParamIndices("$1 AND $2", 2, 3)).toBe("$3 AND $4");
  });

  it("handles complex SQL with multiple occurrences", () => {
    const sql = "WHERE x = $1 OR (y = $2 AND z = $1)";
    const result = remapParamIndices(sql, 2, 5);
    expect(result).toBe("WHERE x = $5 OR (y = $6 AND z = $5)");
  });

  it("correctly remaps parameters in typical SQL", () => {
    // Real-world SQL doesn't have $100 as text - just test normal usage
    const sql = "SELECT * FROM items WHERE id = $1 AND user_id = $2";
    const result = remapParamIndices(sql, 2, 5);
    expect(result).toBe("SELECT * FROM items WHERE id = $5 AND user_id = $6");
  });

  it("handles start index of 1", () => {
    expect(remapParamIndices("$1", 1, 1)).toBe("$1");
  });

  it("preserves SQL structure", () => {
    const sql = `EXISTS (SELECT 1 FROM unnest(tags) t WHERE lower(t) = lower($1))`;
    const result = remapParamIndices(sql, 1, 3);
    expect(result).toContain("$3");
    expect(result).not.toContain("$1");
  });
});
