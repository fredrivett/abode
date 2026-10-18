import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  itemFindUnique,
  userFindFirst,
  highlightFindUnique,
  findMany,
  getUser,
  shareInvitesOpen,
} = vi.hoisted(() => ({
  shareInvitesOpen: vi.fn(),
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
vi.mock("@/lib/invites/share-invite", () => ({ shareInvitesOpen }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import { redirect } from "next/navigation";
import {
  getSaveCtaState,
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
    privacy: "standard",
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
    [
      "the username is a malformed escape",
      { rawUsername: "@bad%zz", id: ITEM_ID },
    ],
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
  it("returns null for a shared sensitive item (its link is paused)", async () => {
    itemFindUnique.mockResolvedValue(makeItem({ privacy: "sensitive" }));
    expect(
      await loadPublicItem({ rawUsername: "@fred", id: ITEM_ID }),
    ).toBeNull();
  });

  it("sends the owner of a sensitive item to its gated dashboard dialog", async () => {
    getUser.mockResolvedValue({ id: OWNER_ID });
    itemFindUnique.mockResolvedValue(makeItem({ privacy: "sensitive" }));
    await expect(
      loadPublicItem({ rawUsername: "@fred", id: ITEM_ID }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith(`/dashboard?item=${ITEM_ID}`);
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

  it("never exposes the owner's private note", async () => {
    highlightFindUnique.mockResolvedValue({
      ...highlightRow,
      note: "private thought",
    });
    const highlight = await getSharedHighlight({
      item: makeItem(),
      highlightId: HIGHLIGHT_ID,
    });
    expect(highlight?.note).toBeNull();
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
    findMany.mockResolvedValue([{ ...highlightRow, note: "private" }]);
    const highlights = await getVisibleHighlights({
      item: makeItem({ sharedHighlights: true }),
      viewerId: null,
    });
    expect(highlights.map((h) => h.id)).toEqual([HIGHLIGHT_ID]);
    expect(highlights[0].note).toBeNull();
  });
});

describe("getSaveCtaState", () => {
  const user = {
    id: OWNER_ID,
    allowShareInvites: true,
  } as unknown as Parameters<typeof getSaveCtaState>[0]["user"];

  it("hides the CTA from the owner", async () => {
    expect(
      await getSaveCtaState({ user, viewerId: OWNER_ID, isOwner: true }),
    ).toBeNull();
  });

  it("offers signed-in readers a straight save, without counting invites", async () => {
    expect(
      await getSaveCtaState({ user, viewerId: "reader", isOwner: false }),
    ).toEqual({ isSignedIn: true, invitesOpen: false });
    expect(shareInvitesOpen).not.toHaveBeenCalled();
  });

  it("tells signed-out readers whether they can join with an invite", async () => {
    shareInvitesOpen.mockResolvedValue(true);
    expect(
      await getSaveCtaState({ user, viewerId: null, isOwner: false }),
    ).toEqual({ isSignedIn: false, invitesOpen: true });
  });
});
