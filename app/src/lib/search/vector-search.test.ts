import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetQueryEmbedding, mockQueryRawUnsafe, mockIsOpenAiConfigured } =
  vi.hoisted(() => ({
    mockGetQueryEmbedding: vi.fn(),
    mockQueryRawUnsafe: vi.fn(),
    mockIsOpenAiConfigured: vi.fn(),
  }));

vi.mock("./embedding-cache", () => ({
  getQueryEmbedding: mockGetQueryEmbedding,
}));
vi.mock("@/lib/embeddings", () => ({
  isOpenAiConfigured: mockIsOpenAiConfigured,
  toVectorLiteral: (embedding: number[]) => `[${embedding.join(",")}]`,
}));
vi.mock("@/lib/db", () => ({
  default: { $queryRawUnsafe: mockQueryRawUnsafe },
}));

import { vectorSearch } from "./vector-search";

const NO_FILTERS = {} as Parameters<typeof vectorSearch>[1];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("vectorSearch", () => {
  it("skips cleanly (returns no results, no embedding call) when OpenAI is unconfigured", async () => {
    mockIsOpenAiConfigured.mockReturnValue(false);

    const results = await vectorSearch("user-1", NO_FILTERS, "sofa");

    expect(results).toEqual([]);
    expect(mockGetQueryEmbedding).not.toHaveBeenCalled();
    expect(mockQueryRawUnsafe).not.toHaveBeenCalled();
  });

  it("embeds the query and runs the search when OpenAI is configured", async () => {
    mockIsOpenAiConfigured.mockReturnValue(true);
    mockGetQueryEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    mockQueryRawUnsafe.mockResolvedValue([{ id: "item-1", similarity: 0.9 }]);

    const results = await vectorSearch("user-1", NO_FILTERS, "sofa");

    expect(mockGetQueryEmbedding).toHaveBeenCalledWith("sofa");
    expect(results).toEqual([{ id: "item-1", similarity: 0.9 }]);
  });
});
