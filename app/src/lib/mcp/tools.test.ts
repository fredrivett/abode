import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockUserFindUnique,
  mockItemFindMany,
  mockItemFindUnique,
  mockHighlightFindMany,
  mockBookFindMany,
  mockRankedSearch,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockItemFindMany: vi.fn(),
  mockItemFindUnique: vi.fn(),
  mockHighlightFindMany: vi.fn(),
  mockBookFindMany: vi.fn(),
  mockRankedSearch: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: {
    user: { findUnique: mockUserFindUnique },
    item: { findMany: mockItemFindMany, findUnique: mockItemFindUnique },
    articleHighlight: { findMany: mockHighlightFindMany },
    itemBookDetails: { findMany: mockBookFindMany },
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

import {
  type DateRange,
  getBookActivity,
  getHighlights,
  getItem,
  getItems,
  MCP_MAX_ARTICLE_TOKENS,
  resolveDateRange,
  truncateToTokenBudget,
} from "./tools";

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
  mockHighlightFindMany.mockResolvedValue([]);
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

  it("caps a very long article body and says so, flags first", async () => {
    // 4 ASCII chars ≈ 1 token, so this is just over the budget
    const content = "x".repeat(MCP_MAX_ARTICLE_TOKENS * 4 + 500);
    mockItemFindUnique.mockResolvedValue({
      id: UUID,
      articleDetails: { author: "A", content },
    });
    const item = await getItem(USER, UUID);
    expect(item?.articleDetails).toEqual({
      author: "A",
      content: content.slice(0, MCP_MAX_ARTICLE_TOKENS * 4),
      contentTruncated: true,
      contentLength: content.length,
    });
    // The flags serialize before the body, so a client cutting the result
    // short still sees them
    expect(Object.keys(item?.articleDetails ?? {}).slice(0, 2)).toEqual([
      "contentTruncated",
      "contentLength",
    ]);
  });

  it("leaves an article within the cap untouched", async () => {
    mockItemFindUnique.mockResolvedValue({
      id: UUID,
      articleDetails: { author: "A", content: "short" },
    });
    const item = await getItem(USER, UUID);
    expect(item?.articleDetails).toEqual({ author: "A", content: "short" });
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

  it("includes the caller's highlights on the item, in reading order", async () => {
    mockItemFindUnique.mockResolvedValue({ id: UUID, title: "T" });
    mockHighlightFindMany.mockResolvedValue([
      {
        id: "h1",
        text: "A passage",
        note: "My note",
        createdAt: new Date("2026-11-05T09:00:00Z"),
        updatedAt: new Date("2026-11-06T09:00:00Z"),
      },
    ]);
    const item = await getItem(USER, UUID);
    expect(mockHighlightFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { itemId: UUID, userId: USER },
        orderBy: { startOffset: "asc" },
      }),
    );
    expect(item?.highlights).toEqual([
      {
        id: "h1",
        text: "A passage",
        note: "My note",
        createdAt: "2026-11-05T09:00:00.000Z",
        updatedAt: "2026-11-06T09:00:00.000Z",
      },
    ]);
  });
});

describe("resolveDateRange", () => {
  it("makes a date-only `to` inclusive of that whole UTC day", () => {
    expect(resolveDateRange({ from: "2026-11-01", to: "2026-11-30" })).toEqual({
      from: new Date("2026-11-01T00:00:00.000Z"),
      to: new Date("2026-11-30T23:59:59.999Z"),
    });
  });

  it("keeps a timestamp `to` exact, and leaves omitted ends unbounded", () => {
    expect(resolveDateRange({ to: "2026-11-30T12:00:00+01:00" })).toEqual({
      from: null,
      to: new Date("2026-11-30T11:00:00.000Z"),
    });
    expect(resolveDateRange({})).toEqual({ from: null, to: null });
  });

  it("rejects an unparseable date or an inverted range", () => {
    expect(resolveDateRange({ from: "last week" })).toBeNull();
    expect(resolveDateRange({ to: "2026-13-45" })).toBeNull();
    expect(
      resolveDateRange({ from: "2026-11-02", to: "2026-11-01" }),
    ).toBeNull();
    // Same day both ends is a valid one-day range
    expect(
      resolveDateRange({ from: "2026-11-01", to: "2026-11-01" }),
    ).not.toBeNull();
  });
});

function range(from: string | null, to: string | null): DateRange {
  return { from: from ? new Date(from) : null, to: to ? new Date(to) : null };
}

describe("getHighlights", () => {
  it("returns the caller's highlights in the period with their item, flagging more", async () => {
    mockHighlightFindMany.mockResolvedValue(
      ["h3", "h2", "h1"].map((id) => ({
        id,
        text: `text ${id}`,
        note: id === "h3" ? "a note" : null,
        createdAt: new Date("2026-11-05T09:00:00Z"),
        updatedAt: new Date("2026-11-05T09:00:00Z"),
        item: { id: "i1", title: "Essay", kind: "article", sourceUrl: null },
      })),
    );

    const result = await getHighlights(USER, {
      range: range("2026-11-04T00:00:00Z", "2026-11-11T23:59:59.999Z"),
      limit: 2,
    });

    expect(mockHighlightFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: USER,
          item: { userId: USER },
          createdAt: {
            gte: new Date("2026-11-04T00:00:00Z"),
            lte: new Date("2026-11-11T23:59:59.999Z"),
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        // One extra row tells whether the limit cut the period short
        take: 3,
      }),
    );
    expect(result.hasMore).toBe(true);
    expect(result.highlights).toEqual([
      {
        id: "h3",
        text: "text h3",
        note: "a note",
        createdAt: "2026-11-05T09:00:00.000Z",
        updatedAt: "2026-11-05T09:00:00.000Z",
        item: {
          id: "i1",
          title: "Essay",
          kind: "article",
          sourceUrl: null,
          url: "https://abode.test/@fred/items/i1",
        },
      },
      expect.objectContaining({ id: "h2" }),
    ]);
  });

  it("drops the date filter for an open-ended range", async () => {
    await getHighlights(USER, { range: range(null, null) });
    expect(mockHighlightFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER, item: { userId: USER }, createdAt: {} },
        take: 51,
      }),
    );
  });
});

function book(over: Record<string, unknown> = {}) {
  return {
    itemId: "b1",
    authors: ["Ursula K. Le Guin"],
    pageCount: 300,
    status: "reading",
    startedAt: null,
    startedAtPrecision: null,
    finishedAt: null,
    finishedAtPrecision: null,
    progressValue: null,
    progressUnit: "page",
    progressUpdatedAt: null,
    rating: null,
    review: null,
    item: { title: "The Dispossessed" },
    ...over,
  };
}

describe("getBookActivity", () => {
  // Wednesday 11 Nov 2026, midday
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-11T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  const lastWeek = range("2026-11-04T00:00:00Z", "2026-11-11T23:59:59.999Z");
  const thisMonth = range("2026-11-01T00:00:00Z", "2026-11-11T23:59:59.999Z");

  async function ids(r: DateRange, rows: ReturnType<typeof book>[]) {
    mockBookFindMany.mockResolvedValue(rows);
    const { books } = await getBookActivity(USER, { range: r });
    return books.map((b) => b.id);
  }

  it("asks only for the caller's books with a requested date in the period", async () => {
    mockBookFindMany.mockResolvedValue([]);
    await getBookActivity(USER, {
      range: thisMonth,
      activities: ["finished", "progressed"],
    });
    const inRange = {
      gte: new Date("2026-11-01T00:00:00Z"),
      lte: new Date("2026-11-11T23:59:59.999Z"),
      not: null,
    };
    expect(mockBookFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          item: { userId: USER },
          OR: [{ finishedAt: inRange }, { progressUpdatedAt: inRange }],
        },
      }),
    );
  });

  it("matches a day-precision date (null precision included) by its exact instant", async () => {
    const rows = [
      book({ itemId: "in", finishedAt: new Date("2026-11-04T00:00:00Z") }),
      book({
        itemId: "out",
        finishedAt: new Date("2026-11-03T23:59:59Z"),
        finishedAtPrecision: "day",
      }),
    ];
    expect(await ids(lastWeek, rows)).toEqual(["in"]);
  });

  it("matches a month-precision date only when the range covers the whole month (up to now)", async () => {
    // "Finished in November" — sometime between 1 Nov and today
    const november = book({
      itemId: "nov",
      finishedAt: new Date("2026-11-01T00:00:00Z"),
      finishedAtPrecision: "month",
    });
    expect(await ids(thisMonth, [november])).toEqual(["nov"]);
    // Could have been before last week, so it isn't claimed for it
    expect(await ids(lastWeek, [november])).toEqual([]);

    const october = book({
      itemId: "oct",
      finishedAt: new Date("2026-10-01T00:00:00Z"),
      finishedAtPrecision: "month",
    });
    expect(
      await ids(range("2026-10-01T00:00:00Z", "2026-10-31T23:59:59.999Z"), [
        october,
      ]),
    ).toEqual(["oct"]);
    // A range stopping short of the month's end misses it
    expect(
      await ids(range("2026-10-01T00:00:00Z", "2026-10-30T23:59:59.999Z"), [
        october,
      ]),
    ).toEqual([]);
  });

  it("matches a year-precision date only for a range covering the year", async () => {
    const thisYear = book({
      itemId: "y",
      startedAt: new Date("2026-01-01T00:00:00Z"),
      startedAtPrecision: "year",
    });
    expect(await ids(thisMonth, [thisYear])).toEqual([]);
    expect(await ids(range("2026-01-01T00:00:00Z", null), [thisYear])).toEqual([
      "y",
    ]);
    expect(
      await ids(range("2025-06-01T00:00:00Z", "2026-11-11T23:59:59.999Z"), [
        thisYear,
      ]),
    ).toEqual(["y"]);
  });

  it("lists which activities fell in the period, most recent first, with stars and normalised precision", async () => {
    mockBookFindMany.mockResolvedValue([
      book({
        itemId: "started-old-finished-now",
        status: "read",
        startedAt: new Date("2026-09-01T00:00:00Z"),
        startedAtPrecision: "month",
        finishedAt: new Date("2026-11-09T18:00:00Z"),
        progressValue: 300,
        progressUpdatedAt: new Date("2026-11-09T18:00:00Z"),
        rating: 7,
        review: "Loved it",
      }),
      book({
        itemId: "progressed",
        progressValue: 120,
        progressUpdatedAt: new Date("2026-11-10T21:00:00Z"),
      }),
      // Returned by the DB but nothing matches once precision is applied
      book({
        itemId: "coarse",
        startedAt: new Date("2026-01-01T00:00:00Z"),
        startedAtPrecision: "year",
      }),
    ]);

    const result = await getBookActivity(USER, { range: lastWeek });

    expect(result.hasMore).toBe(false);
    expect(result.books.map((b) => [b.id, b.activity])).toEqual([
      ["progressed", ["progressed"]],
      ["started-old-finished-now", ["finished", "progressed"]],
    ]);
    expect(result.books[1]).toEqual({
      id: "started-old-finished-now",
      url: "https://abode.test/@fred/items/started-old-finished-now",
      title: "The Dispossessed",
      authors: ["Ursula K. Le Guin"],
      status: "read",
      activity: ["finished", "progressed"],
      startedAt: "2026-09-01T00:00:00.000Z",
      startedAtPrecision: "month",
      finishedAt: "2026-11-09T18:00:00.000Z",
      finishedAtPrecision: "day",
      progressValue: 300,
      progressUnit: "page",
      pageCount: 300,
      progressUpdatedAt: "2026-11-09T18:00:00.000Z",
      ratingStars: 3.5,
      review: "Loved it",
    });
    expect(result.books[0]?.startedAtPrecision).toBeNull();
  });

  it("only reports the requested activities", async () => {
    mockBookFindMany.mockResolvedValue([
      book({
        itemId: "both",
        startedAt: new Date("2026-11-05T00:00:00Z"),
        finishedAt: new Date("2026-11-08T00:00:00Z"),
      }),
      book({ itemId: "started", startedAt: new Date("2026-11-06T00:00:00Z") }),
    ]);
    const { books } = await getBookActivity(USER, {
      range: lastWeek,
      activities: ["finished"],
    });
    expect(books.map((b) => [b.id, b.activity])).toEqual([
      ["both", ["finished"]],
    ]);
  });

  it("caps at the limit and says there are more", async () => {
    mockBookFindMany.mockResolvedValue(
      ["a", "b", "c"].map((itemId, i) =>
        book({ itemId, finishedAt: new Date(`2026-11-0${5 + i}T00:00:00Z`) }),
      ),
    );
    const result = await getBookActivity(USER, { range: lastWeek, limit: 2 });
    expect(result.books.map((b) => b.id)).toEqual(["c", "b"]);
    expect(result.hasMore).toBe(true);
  });
});

describe("truncateToTokenBudget", () => {
  it("returns null when ASCII text fits (~4 chars per token)", () => {
    expect(truncateToTokenBudget("a".repeat(400), 100)).toBeNull();
  });

  it("budgets non-ASCII text at a token per char, so CJK is cut far sooner", () => {
    const cjk = "字".repeat(400);
    expect(truncateToTokenBudget(cjk, 100)).toBe("字".repeat(100));
  });

  it("never splits a surrogate pair", () => {
    const emoji = "😀".repeat(10);
    const cut = truncateToTokenBudget(emoji, 3);
    expect(cut).toBe("😀😀😀");
  });
});
