import { beforeEach, describe, expect, it, vi } from "vitest";

const { userFindFirst, itemFindUnique } = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  itemFindUnique: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  default: {
    user: { findFirst: userFindFirst },
    item: { findUnique: itemFindUnique },
  },
}));

import { getOgBookReview } from "./data";

const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const OWNER_ID = "33333333-3333-4333-8333-333333333333";

function bookRow(overrides: Record<string, unknown> = {}) {
  return {
    kind: "book",
    title: "Elon Musk",
    meta: { coverWidth: 600, coverHeight: 900 },
    coverFileKey: "covers/elon.jpg",
    imageDetails: { colors: [{ hex: "#1c1d22", name: "black", score: 0.9 }] },
    userId: OWNER_ID,
    sharedAt: new Date(),
    excludeFromPublicRooms: false,
    roomItems: [],
    bookDetails: {
      authors: ["Walter Isaacson"],
      publisher: "Simon & Schuster",
      publishedAt: null,
      isbn: null,
      pageCount: 688,
      domain: null,
      status: "read",
      startedAt: new Date("2023-11-01T00:00:00.000Z"),
      startedAtPrecision: "month",
      finishedAt: null,
      finishedAtPrecision: null,
      rating: 7,
      review: "Fascinating.",
    },
    ...overrides,
  };
}

const lookup = (overrides: { username?: string; itemId?: string } = {}) =>
  getOgBookReview({ username: "fred", itemId: ITEM_ID, ...overrides });

describe("getOgBookReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindFirst.mockResolvedValue({ id: OWNER_ID, username: "fred" });
  });

  it("returns the card data for a shared book", async () => {
    itemFindUnique.mockResolvedValue(bookRow());

    expect(await lookup()).toEqual({
      title: "Elon Musk",
      authors: ["Walter Isaacson"],
      coverFileKey: "covers/elon.jpg",
      coverRatio: 600 / 900,
      coverColor: "#1c1d22",
      review: {
        status: "read",
        rating: 7,
        review: "Fascinating.",
        startedAt: "2023-11-01T00:00:00.000Z",
        startedAtPrecision: "month",
        finishedAt: null,
        finishedAtPrecision: null,
      },
      ownerUsername: "fred",
    });
  });

  it("never selects private reading progress", async () => {
    itemFindUnique.mockResolvedValue(bookRow());
    await lookup();
    const select = itemFindUnique.mock.calls[0]?.[0].select;
    expect(select.bookDetails.select).not.toHaveProperty("progressValue");
    expect(select).not.toHaveProperty("notes");
  });

  it("falls back for a book that isn't publicly viewable", async () => {
    itemFindUnique.mockResolvedValue(bookRow({ sharedAt: null }));
    expect(await lookup()).toBeNull();
  });

  it("falls back for an item that isn't a book", async () => {
    itemFindUnique.mockResolvedValue(bookRow({ kind: "article" }));
    expect(await lookup()).toBeNull();
  });

  it("falls back when the book belongs to someone else", async () => {
    itemFindUnique.mockResolvedValue(bookRow({ userId: "someone-else" }));
    expect(await lookup()).toBeNull();
  });

  it("falls back for an unknown user", async () => {
    userFindFirst.mockResolvedValue(null);
    expect(await lookup()).toBeNull();
    expect(itemFindUnique).not.toHaveBeenCalled();
  });

  it("rejects a malformed item id without querying", async () => {
    expect(await lookup({ itemId: "not-a-uuid" })).toBeNull();
    expect(userFindFirst).not.toHaveBeenCalled();
  });
});
