import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFullText, mockOcr, mockVector } = vi.hoisted(() => ({
  mockFullText: vi.fn(),
  mockOcr: vi.fn(),
  mockVector: vi.fn(),
}));

// Mock the three retrievers; use the real RRF merge so ordering is exercised.
vi.mock("@/lib/search/full-text-search", () => ({
  fullTextSearch: mockFullText,
  ocrTextSearch: mockOcr,
}));
vi.mock("@/lib/search/vector-search", () => ({
  vectorSearch: mockVector,
}));

import { DEFAULT_RANKED_LIMIT, rankedSearch } from "./ranked-search";

const NO_FILTERS = {} as Parameters<typeof rankedSearch>[1];

beforeEach(() => {
  vi.clearAllMocks();
  mockFullText.mockResolvedValue([]);
  mockOcr.mockResolvedValue([]);
  mockVector.mockResolvedValue([]);
});

describe("rankedSearch", () => {
  it("fuses the three retrievers and attaches per-source metadata", async () => {
    mockFullText.mockResolvedValue([
      { id: "a", rank: 1 },
      { id: "b", rank: 2 },
    ]);
    mockVector.mockResolvedValue([
      { id: "b", similarity: 0.9 },
      { id: "c", similarity: 0.8 },
    ]);
    mockOcr.mockResolvedValue([{ id: "a", rank: 1, snippet: "<b>hi</b>" }]);

    const results = await rankedSearch("user-1", NO_FILTERS, "hi");
    const byId = new Map(results.map((r) => [r.id, r]));

    expect(byId.get("a")?.sources.sort()).toEqual(["fulltext", "ocr"]);
    expect(byId.get("a")?.ocrSnippet).toBe("<b>hi</b>");
    expect(byId.get("a")?.vectorSimilarity).toBeNull();

    expect(byId.get("b")?.sources.sort()).toEqual(["fulltext", "vector"]);
    expect(byId.get("b")?.vectorSimilarity).toBe(0.9);
    expect(byId.get("b")?.ocrSnippet).toBeNull();

    expect(byId.get("c")?.sources).toEqual(["vector"]);
    expect(byId.get("c")?.vectorSimilarity).toBe(0.8);

    // The single-source item ranks below the two-source items
    expect(results.at(-1)?.id).toBe("c");
  });

  it("returns an empty list when every retriever is empty", async () => {
    expect(await rankedSearch("user-1", NO_FILTERS, "nothing")).toEqual([]);
  });

  it("degrades to text + OCR and signals when vector search fails", async () => {
    mockFullText.mockResolvedValue([{ id: "a", rank: 1 }]);
    mockVector.mockRejectedValue(new Error("vector down"));
    const onVectorUnavailable = vi.fn();

    const results = await rankedSearch("user-1", NO_FILTERS, "hi", {
      onVectorUnavailable,
    });

    expect(onVectorUnavailable).toHaveBeenCalledOnce();
    expect(results.map((r) => r.id)).toEqual(["a"]);
    expect(results[0]?.vectorSimilarity).toBeNull();
  });

  it("passes the default limit to each retriever, or an override", async () => {
    await rankedSearch("user-1", NO_FILTERS, "hi");
    expect(mockFullText).toHaveBeenCalledWith(
      "user-1",
      NO_FILTERS,
      "hi",
      DEFAULT_RANKED_LIMIT,
    );

    await rankedSearch("user-1", NO_FILTERS, "hi", { limit: 5 });
    expect(mockVector).toHaveBeenLastCalledWith("user-1", NO_FILTERS, "hi", 5);
  });
});
