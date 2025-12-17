import { describe, expect, it } from "vitest";
import { mergeSearchResults, reciprocalRankFusion } from "./rrf";

describe("reciprocalRankFusion", () => {
  describe("basic functionality", () => {
    it("returns empty array for empty input", () => {
      const result = reciprocalRankFusion(new Map());
      expect(result).toEqual([]);
    });

    it("calculates RRF scores for single result set", () => {
      const resultSets = new Map([["source1", ["a", "b", "c"]]]);
      const result = reciprocalRankFusion(resultSets, { k: 60 });

      // RRF formula: 1/(k + rank + 1) where rank is 0-indexed
      // Item a: 1/(60 + 0 + 1) = 1/61
      // Item b: 1/(60 + 1 + 1) = 1/62
      // Item c: 1/(60 + 2 + 1) = 1/63
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe("a");
      expect(result[0].score).toBeCloseTo(1 / 61, 6);
      expect(result[1].id).toBe("b");
      expect(result[1].score).toBeCloseTo(1 / 62, 6);
      expect(result[2].id).toBe("c");
      expect(result[2].score).toBeCloseTo(1 / 63, 6);
    });

    it("boosts items appearing in multiple result sets", () => {
      const resultSets = new Map([
        ["source1", ["a", "b", "c"]],
        ["source2", ["b", "c", "d"]],
      ]);
      const result = reciprocalRankFusion(resultSets, { k: 60 });

      // Item b appears in both: rank 1 in source1, rank 0 in source2
      // Score = 1/(60+2) + 1/(60+1) = 1/62 + 1/61
      const itemB = result.find((r) => r.id === "b");
      expect(itemB?.score).toBeCloseTo(1 / 62 + 1 / 61, 6);
      expect(itemB?.sources).toContain("source1");
      expect(itemB?.sources).toContain("source2");

      // Item c appears in both: rank 2 in source1, rank 1 in source2
      const itemC = result.find((r) => r.id === "c");
      expect(itemC?.score).toBeCloseTo(1 / 63 + 1 / 62, 6);

      // Item a only appears once (rank 0 in source1)
      const itemA = result.find((r) => r.id === "a");
      expect(itemA?.score).toBeCloseTo(1 / 61, 6);
      expect(itemA?.sources).toEqual(["source1"]);
    });
  });

  describe("ranking and ordering", () => {
    it("returns results sorted by score descending", () => {
      const resultSets = new Map([
        ["source1", ["a", "b"]],
        ["source2", ["b", "a"]],
      ]);
      const result = reciprocalRankFusion(resultSets, { k: 60 });

      // Both items appear in both sources but at different ranks
      // a: rank 0 in source1, rank 1 in source2 = 1/61 + 1/62
      // b: rank 1 in source1, rank 0 in source2 = 1/62 + 1/61
      // Same score, so order could be either, but both should be present
      expect(result).toHaveLength(2);
      expect(result[0].score).toBeCloseTo(result[1].score, 6);
    });

    it("tracks sources correctly", () => {
      const resultSets = new Map([
        ["fulltext", ["a", "b"]],
        ["vector", ["b", "c"]],
        ["ocr", ["c", "d"]],
      ]);
      const result = reciprocalRankFusion(resultSets);

      const itemA = result.find((r) => r.id === "a");
      expect(itemA?.sources).toEqual(["fulltext"]);

      const itemB = result.find((r) => r.id === "b");
      expect(itemB?.sources).toContain("fulltext");
      expect(itemB?.sources).toContain("vector");

      const itemC = result.find((r) => r.id === "c");
      expect(itemC?.sources).toContain("vector");
      expect(itemC?.sources).toContain("ocr");

      const itemD = result.find((r) => r.id === "d");
      expect(itemD?.sources).toEqual(["ocr"]);
    });
  });

  describe("options", () => {
    it("respects limit option", () => {
      const resultSets = new Map([["source", ["a", "b", "c", "d", "e"]]]);
      const result = reciprocalRankFusion(resultSets, { limit: 3 });

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.id)).toEqual(["a", "b", "c"]);
    });

    it("uses default k=60 when not specified", () => {
      const resultSets = new Map([["source", ["a"]]]);
      const result = reciprocalRankFusion(resultSets);

      // Default k=60: 1/(60 + 0 + 1) = 1/61
      expect(result[0].score).toBeCloseTo(1 / 61, 6);
    });

    it("uses custom k value", () => {
      const resultSets = new Map([["source", ["a"]]]);
      const result = reciprocalRankFusion(resultSets, { k: 30 });

      // Custom k=30: 1/(30 + 0 + 1) = 1/31
      expect(result[0].score).toBeCloseTo(1 / 31, 6);
    });

    it("defaults to limit=100", () => {
      const ids = Array.from({ length: 150 }, (_, i) => `item-${i}`);
      const resultSets = new Map([["source", ids]]);
      const result = reciprocalRankFusion(resultSets);

      expect(result).toHaveLength(100);
    });
  });
});

describe("mergeSearchResults", () => {
  it("merges fulltext and vector results", () => {
    const textResults = [{ id: "a", rank: 1 }, { id: "b", rank: 2 }];
    const vectorResults = [{ id: "b", similarity: 0.9 }, { id: "c", similarity: 0.8 }];

    const result = mergeSearchResults(textResults, vectorResults);

    expect(result).toHaveLength(3);

    // b appears in both
    const itemB = result.find((r) => r.id === "b");
    expect(itemB?.sources).toContain("fulltext");
    expect(itemB?.sources).toContain("vector");
  });

  it("merges fulltext, vector, and OCR results", () => {
    const textResults = [{ id: "a" }];
    const vectorResults = [{ id: "b" }];
    const ocrResults = [{ id: "c" }];

    const result = mergeSearchResults(textResults, vectorResults, ocrResults);

    expect(result).toHaveLength(3);
    expect(result.find((r) => r.id === "a")?.sources).toEqual(["fulltext"]);
    expect(result.find((r) => r.id === "b")?.sources).toEqual(["vector"]);
    expect(result.find((r) => r.id === "c")?.sources).toEqual(["ocr"]);
  });

  it("handles empty result sets", () => {
    const result = mergeSearchResults([], [], []);
    expect(result).toEqual([]);
  });

  it("handles only fulltext results", () => {
    const textResults = [{ id: "a" }, { id: "b" }];
    const result = mergeSearchResults(textResults, []);

    expect(result).toHaveLength(2);
    expect(result[0].sources).toEqual(["fulltext"]);
  });

  it("handles only vector results", () => {
    const vectorResults = [{ id: "a" }, { id: "b" }];
    const result = mergeSearchResults([], vectorResults);

    expect(result).toHaveLength(2);
    expect(result[0].sources).toEqual(["vector"]);
  });

  it("handles only OCR results", () => {
    const ocrResults = [{ id: "a" }, { id: "b" }];
    const result = mergeSearchResults([], [], ocrResults);

    expect(result).toHaveLength(2);
    expect(result[0].sources).toEqual(["ocr"]);
  });

  it("passes through RRF options", () => {
    const textResults = Array.from({ length: 50 }, (_, i) => ({ id: `t-${i}` }));
    const vectorResults = Array.from({ length: 50 }, (_, i) => ({ id: `v-${i}` }));

    const result = mergeSearchResults(textResults, vectorResults, [], { limit: 10 });
    expect(result).toHaveLength(10);
  });

  it("boosts items appearing in all three sources", () => {
    const textResults = [{ id: "shared" }, { id: "text-only" }];
    const vectorResults = [{ id: "shared" }, { id: "vector-only" }];
    const ocrResults = [{ id: "shared" }, { id: "ocr-only" }];

    const result = mergeSearchResults(textResults, vectorResults, ocrResults);

    // "shared" appears first because it's boosted by all three sources
    expect(result[0].id).toBe("shared");
    expect(result[0].sources).toContain("fulltext");
    expect(result[0].sources).toContain("vector");
    expect(result[0].sources).toContain("ocr");
    // Score should be roughly 3x a single-source item
    expect(result[0].score).toBeGreaterThan(result[1].score * 2);
  });
});
