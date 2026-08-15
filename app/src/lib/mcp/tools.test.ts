import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockUserFindUnique,
  mockItemFindMany,
  mockItemFindUnique,
  mockRankedSearch,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockItemFindMany: vi.fn(),
  mockItemFindUnique: vi.fn(),
  mockRankedSearch: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: {
    user: { findUnique: mockUserFindUnique },
    item: { findMany: mockItemFindMany, findUnique: mockItemFindUnique },
  },
}));
vi.mock("@/lib/search/ranked-search", () => ({
  rankedSearch: mockRankedSearch,
}));
vi.mock("@/lib/items/query", () => ({
  itemSelect: {},
  transformItem: (item: unknown) => item,
}));
vi.mock("@/lib/items/available-filters", () => ({
  getAvailableFilters: vi.fn(),
}));
vi.mock("@/lib/rooms", () => ({ listUserRooms: vi.fn() }));
vi.mock("@/lib/url", () => ({ getAppBaseUrl: () => "https://abode.test" }));

import { getItem, getItems } from "./tools";

const USER = "user-1";
const UUID = "11111111-1111-4111-8111-111111111111";

function row(over: Record<string, unknown> = {}) {
  return {
    id: "i1",
    kind: "article",
    title: "Title",
    description: "Desc",
    tags: ["ai"],
    userTags: ["fav"],
    sourceUrl: "https://example.com",
    createdAt: new Date("2026-02-01T00:00:00Z"),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUserFindUnique.mockResolvedValue({ username: "fred" });
});

describe("getItems — recent mode", () => {
  it("lists newest items with a deep link and merged tags", async () => {
    mockItemFindMany.mockResolvedValue([row({ id: "a" }), row({ id: "b" })]);

    const items = await getItems(USER, {});

    expect(mockRankedSearch).not.toHaveBeenCalled();
    expect(mockItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
      }),
    );
    expect(items[0]).toMatchObject({
      id: "a",
      url: "https://abode.test/@fred/items/a",
      tags: ["ai", "fav"],
      createdAt: "2026-02-01T00:00:00.000Z",
    });
  });

  it("narrows by tags, valid kinds, and since (dropping unknown kinds)", async () => {
    mockItemFindMany.mockResolvedValue([]);

    await getItems(USER, {
      tags: ["design"],
      kinds: ["article", "bogus"],
      since: "2026-01-01",
    });

    expect(mockItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: USER,
          OR: [
            { tags: { hasSome: ["design"] } },
            { userTags: { hasSome: ["design"] } },
          ],
          kind: { in: ["article"] },
          createdAt: { gte: new Date("2026-01-01") },
        },
      }),
    );
  });

  it("clamps the limit to the max", async () => {
    mockItemFindMany.mockResolvedValue([]);
    await getItems(USER, { limit: 999 });
    expect(mockItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it("returns a null url when the user has no username", async () => {
    mockUserFindUnique.mockResolvedValue({ username: null });
    mockItemFindMany.mockResolvedValue([row({ id: "a" })]);

    const items = await getItems(USER, {});
    expect(items[0]?.url).toBeNull();
  });
});

describe("getItems — query mode", () => {
  it("ORs multi-value tags/kinds, preserves RRF order, and attaches the snippet", async () => {
    mockRankedSearch.mockResolvedValue([
      {
        id: "b",
        sources: ["ocr"],
        ocrSnippet: "<b>hit</b>",
        vectorSimilarity: null,
      },
      {
        id: "a",
        sources: ["fulltext"],
        ocrSnippet: null,
        vectorSimilarity: null,
      },
    ]);
    // Returned unordered — order must come from the ranking, not the DB
    mockItemFindMany.mockResolvedValue([row({ id: "a" }), row({ id: "b" })]);

    const items = await getItems(USER, {
      query: "  branding  ",
      tags: ["design", "brand"],
      kinds: ["article", "image"],
    });

    // Each array shares one orGroup so values OR together; no capture-date filter
    expect(mockRankedSearch).toHaveBeenCalledWith(
      USER,
      {
        tag: [
          { value: "design", negated: false, orGroup: 0 },
          { value: "brand", negated: false, orGroup: 0 },
        ],
        type: [
          { value: "article", negated: false, orGroup: 0 },
          { value: "image", negated: false, orGroup: 0 },
        ],
      },
      "branding",
      { limit: 20 },
    );
    expect(mockItemFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["b", "a"] }, userId: USER },
      select: expect.anything(),
    });
    expect(items.map((i) => i.id)).toEqual(["b", "a"]);
    expect(items[0]?.matchSnippet).toBe("<b>hit</b>");
    expect(items[1]).not.toHaveProperty("matchSnippet");
  });

  it("ignores `since` in query mode (date filtering is browse-only)", async () => {
    mockRankedSearch.mockResolvedValue([
      {
        id: "a",
        sources: ["fulltext"],
        ocrSnippet: null,
        vectorSimilarity: null,
      },
    ]);
    mockItemFindMany.mockResolvedValue([row({ id: "a" })]);

    await getItems(USER, { query: "branding", since: "2026-01-01" });

    // since is neither passed to ranked search nor applied at hydration
    expect(mockRankedSearch).toHaveBeenCalledWith(USER, {}, "branding", {
      limit: 20,
    });
    expect(mockItemFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["a"] }, userId: USER },
      select: expect.anything(),
    });
  });

  it("returns nothing when the search has no hits", async () => {
    mockRankedSearch.mockResolvedValue([]);
    const items = await getItems(USER, { query: "nothing" });
    expect(items).toEqual([]);
    expect(mockItemFindMany).not.toHaveBeenCalled();
  });
});

describe("getItem", () => {
  it("rejects a non-uuid id without hitting the database", async () => {
    expect(await getItem(USER, "not-a-uuid")).toBeNull();
    expect(mockItemFindUnique).not.toHaveBeenCalled();
  });

  it("returns null when the item isn't the user's", async () => {
    mockItemFindUnique.mockResolvedValue(null);
    expect(await getItem(USER, UUID)).toBeNull();
    expect(mockItemFindUnique).toHaveBeenCalledWith({
      where: { id: UUID, userId: USER },
      select: {},
    });
  });

  it("returns the item detail with a deep link", async () => {
    mockItemFindUnique.mockResolvedValue({ id: UUID, title: "T" });
    const item = await getItem(USER, UUID);
    expect(item).toMatchObject({
      id: UUID,
      title: "T",
      url: `https://abode.test/@fred/items/${UUID}`,
    });
  });
});
