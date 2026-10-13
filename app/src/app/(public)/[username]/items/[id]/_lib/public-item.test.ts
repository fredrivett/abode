import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  itemFindUnique,
  userFindFirst,
  highlightFindUnique,
  findMany,
  getUser,
} = vi.hoisted(() => ({
  itemFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  highlightFindUnique: vi.fn(),
  findMany: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: {
    item: { findUnique: itemFindUnique },
    user: { findFirst: userFindFirst },
    articleHighlight: { findUnique: highlightFindUnique, findMany },
  },
}));
vi.mock("@/lib/user", () => ({ getAuthenticatedUser: getUser }));

import {
  getSharedHighlight,
  getVisibleHighlights,
  loadPublicItem,
} from "./public-item";

const OWNER_ID = "33333333-3333-4333-8333-333333333333";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const HIGHLIGHT_ID = "11111111-1111-4111-8111-111111111111";

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: ITEM_ID,
    kind: "article",
    userId: OWNER_ID,
    sharedAt: new Date(),
    sharedHighlights: false,
    excludeFromPublicRooms: false,
    roomItems: [],
    ...overrides,
  } as unknown as Parameters<typeof getSharedHighlight>[0]["item"];
}

const highlightRow = {
  id: HIGHLIGHT_ID,
  startOffset: 0,
  endOffset: 10,
  text: "Less, but better.",
  note: null,
  createdAt: new Date("2026-10-01T09:00:00.000Z"),
  itemId: ITEM_ID,
  userId: OWNER_ID,
};

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue(null);
  userFindFirst.mockResolvedValue({ id: OWNER_ID, username: "fred" });
});

describe("loadPublicItem", () => {
  it("loads a shared item for a signed-out viewer", async () => {
    itemFindUnique.mockResolvedValue(makeItem());
    const loaded = await loadPublicItem({ rawUsername: "@fred", id: ITEM_ID });
    expect(loaded).toMatchObject({ viewerId: null, isOwner: false });
  });

  it("flags the owner viewing their own item", async () => {
    getUser.mockResolvedValue({ id: OWNER_ID });
    itemFindUnique.mockResolvedValue(makeItem({ sharedAt: null }));
    const loaded = await loadPublicItem({ rawUsername: "@fred", id: ITEM_ID });
    expect(loaded?.isOwner).toBe(true);
  });

  it.each([
    ["the username lacks an @", { rawUsername: "fred", id: ITEM_ID }],
    ["the id isn't a uuid", { rawUsername: "@fred", id: "nope" }],
  ])("returns null when %s", async (_, args) => {
    expect(await loadPublicItem(args)).toBeNull();
    expect(itemFindUnique).not.toHaveBeenCalled();
  });

  it("returns null for another user's item", async () => {
    itemFindUnique.mockResolvedValue(makeItem({ userId: "someone-else" }));
    expect(
      await loadPublicItem({ rawUsername: "@fred", id: ITEM_ID }),
    ).toBeNull();
  });

  it("returns null when the viewer can't see the item", async () => {
    itemFindUnique.mockResolvedValue(makeItem({ sharedAt: null }));
    expect(
      await loadPublicItem({ rawUsername: "@fred", id: ITEM_ID }),
    ).toBeNull();
  });
});

describe("getSharedHighlight", () => {
  it("returns the highlight without its ownership fields", async () => {
    highlightFindUnique.mockResolvedValue(highlightRow);
    expect(
      await getSharedHighlight({ item: makeItem(), highlightId: HIGHLIGHT_ID }),
    ).toEqual({
      id: HIGHLIGHT_ID,
      startOffset: 0,
      endOffset: 10,
      text: "Less, but better.",
      note: null,
      createdAt: "2026-10-01T09:00:00.000Z",
    });
  });

  it.each([
    ["on another item", { itemId: "other-item" }],
    ["by another user", { userId: "other-user" }],
  ])("returns null for a highlight %s", async (_, overrides) => {
    highlightFindUnique.mockResolvedValue({ ...highlightRow, ...overrides });
    expect(
      await getSharedHighlight({ item: makeItem(), highlightId: HIGHLIGHT_ID }),
    ).toBeNull();
  });

  it("returns null for non-articles and non-uuid ids without querying", async () => {
    expect(
      await getSharedHighlight({
        item: makeItem({ kind: "webpage" }),
        highlightId: HIGHLIGHT_ID,
      }),
    ).toBeNull();
    expect(
      await getSharedHighlight({ item: makeItem(), highlightId: "nope" }),
    ).toBeNull();
    expect(highlightFindUnique).not.toHaveBeenCalled();
  });
});

describe("getVisibleHighlights", () => {
  it("hides the owner's highlights from others unless opted in", async () => {
    expect(
      await getVisibleHighlights({ item: makeItem(), viewerId: null }),
    ).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns them when the item shares its highlights", async () => {
    findMany.mockResolvedValue([highlightRow]);
    const highlights = await getVisibleHighlights({
      item: makeItem({ sharedHighlights: true }),
      viewerId: null,
    });
    expect(highlights.map((h) => h.id)).toEqual([HIGHLIGHT_ID]);
  });
});
