import { beforeEach, describe, expect, it, vi } from "vitest";

const { userFindFirst, highlightFindFirst } = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  highlightFindFirst: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  default: {
    user: { findFirst: userFindFirst },
    articleHighlight: { findFirst: highlightFindFirst },
  },
}));

import { getOgHighlight } from "./data";

const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const HIGHLIGHT_ID = "11111111-1111-4111-8111-111111111111";
const OWNER_ID = "33333333-3333-4333-8333-333333333333";

function highlightRow(item: Record<string, unknown> = {}) {
  return {
    text: "Less, but better.",
    item: {
      title: "Good design",
      userId: OWNER_ID,
      sharedAt: new Date(),
      excludeFromPublicRooms: false,
      roomItems: [],
      articleDetails: { domain: "example.com" },
      ...item,
    },
  };
}

const lookup = (
  overrides: Partial<Parameters<typeof getOgHighlight>[0]> = {},
) =>
  getOgHighlight({
    username: "fred",
    itemId: ITEM_ID,
    highlightId: HIGHLIGHT_ID,
    ...overrides,
  });

describe("getOgHighlight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindFirst.mockResolvedValue({ id: OWNER_ID, username: "fred" });
  });

  it("returns the card data for a highlight on a shared article", async () => {
    highlightFindFirst.mockResolvedValue(highlightRow());

    expect(await lookup()).toEqual({
      text: "Less, but better.",
      itemTitle: "Good design",
      domain: "example.com",
      ownerUsername: "fred",
    });
    // Scoped to the item and owner in the URL, not just the highlight id
    expect(highlightFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: HIGHLIGHT_ID, itemId: ITEM_ID, userId: OWNER_ID },
      }),
    );
  });

  it("doesn't need the item's sharedHighlights opt-in", async () => {
    highlightFindFirst.mockResolvedValue(
      highlightRow({ sharedHighlights: false }),
    );
    expect(await lookup()).not.toBeNull();
  });

  it("returns null when the article isn't publicly viewable", async () => {
    highlightFindFirst.mockResolvedValue(highlightRow({ sharedAt: null }));
    expect(await lookup()).toBeNull();
  });

  it("returns null when the highlight isn't on that item", async () => {
    highlightFindFirst.mockResolvedValue(null);
    expect(await lookup()).toBeNull();
  });

  it("returns null for an unknown user", async () => {
    userFindFirst.mockResolvedValue(null);
    expect(await lookup()).toBeNull();
    expect(highlightFindFirst).not.toHaveBeenCalled();
  });

  it("rejects non-uuid ids without querying", async () => {
    expect(await lookup({ highlightId: "nope" })).toBeNull();
    expect(await lookup({ itemId: "nope" })).toBeNull();
    expect(userFindFirst).not.toHaveBeenCalled();
  });
});
