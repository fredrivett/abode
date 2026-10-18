import { describe, expect, test } from "vitest";
import {
  canViewItem,
  canViewItemHighlights,
  type ItemAccessInput,
  itemViewableWhere,
} from "./access";
import { ITEM_PRIVACY_LEVELS } from "./privacy";

const OWNER = "owner-id";
const PRIVACY = ITEM_PRIVACY_LEVELS;
const OTHER = "other-id";

function makeItem(overrides: Partial<ItemAccessInput> = {}): ItemAccessInput {
  return {
    userId: OWNER,
    sharedAt: null,
    privacy: "standard",
    roomItems: [],
    ...overrides,
  };
}

function inRooms(...visibilities: ("public" | "private")[]) {
  return visibilities.map((visibility) => ({ room: { visibility } }));
}

describe("canViewItem", () => {
  test("owner can always view, even when unshared and in no rooms", () => {
    expect(canViewItem(makeItem(), OWNER)).toBe(true);
  });

  test.each(PRIVACY)("owner can always view a %s item", (privacy) => {
    const item = makeItem({ privacy, roomItems: inRooms("private") });
    expect(canViewItem(item, OWNER)).toBe(true);
  });

  test("non-owner cannot view an unshared, room-less item", () => {
    expect(canViewItem(makeItem(), OTHER)).toBe(false);
  });

  test("non-owner cannot view an item only in private rooms", () => {
    const item = makeItem({ roomItems: inRooms("private", "private") });
    expect(canViewItem(item, OTHER)).toBe(false);
  });

  test("non-owner can view an item directly shared via link", () => {
    const item = makeItem({ sharedAt: new Date() });
    expect(canViewItem(item, OTHER)).toBe(true);
  });

  test("non-owner can view an item in a public room", () => {
    const item = makeItem({ roomItems: inRooms("private", "public") });
    expect(canViewItem(item, OTHER)).toBe(true);
  });

  test.each([
    ["standard", true],
    ["unlisted", false],
    ["sensitive", false],
  ] as const)(
    "non-owner can view a public-room %s item: %s",
    (privacy, expected) => {
      const item = makeItem({ privacy, roomItems: inRooms("public") });
      expect(canViewItem(item, OTHER)).toBe(expected);
    },
  );

  test.each([
    ["standard", true],
    ["unlisted", true],
    ["sensitive", false],
  ] as const)(
    "non-owner can follow a share link to a %s item: %s",
    (privacy, expected) => {
      const item = makeItem({
        sharedAt: new Date(),
        privacy,
        roomItems: inRooms("private"),
      });
      expect(canViewItem(item, OTHER)).toBe(expected);
    },
  );

  test("a sensitive item in a public room with a share link stays owner-only", () => {
    const item = makeItem({
      sharedAt: new Date(),
      privacy: "sensitive",
      roomItems: inRooms("public"),
    });
    expect(canViewItem(item, OTHER)).toBe(false);
    expect(canViewItem(item, null)).toBe(false);
  });

  describe("signed-out viewer (viewerId null)", () => {
    test("cannot view a private, unshared item", () => {
      const item = makeItem({ roomItems: inRooms("private") });
      expect(canViewItem(item, null)).toBe(false);
    });

    test("can view a shared item", () => {
      expect(canViewItem(makeItem({ sharedAt: new Date() }), null)).toBe(true);
    });

    test("can view a public-room item", () => {
      const item = makeItem({ roomItems: inRooms("public") });
      expect(canViewItem(item, null)).toBe(true);
    });

    test("is never treated as the owner", () => {
      // userId is non-null but viewerId is null — must not match as owner.
      expect(canViewItem(makeItem(), null)).toBe(false);
    });
  });
});

describe("itemViewableWhere", () => {
  const sharedGrant = {
    sharedAt: { not: null },
    privacy: { not: "sensitive" },
  };
  const publicRoomGrant = {
    privacy: "standard",
    roomItems: { some: { room: { visibility: "public" } } },
  };

  test("authenticated viewer gets owner, shared and public-room grants", () => {
    expect(itemViewableWhere(OWNER)).toEqual({
      OR: [{ userId: OWNER }, sharedGrant, publicRoomGrant],
    });
  });

  test("signed-out viewer gets only the shared and public-room grants", () => {
    expect(itemViewableWhere(null)).toEqual({
      OR: [sharedGrant, publicRoomGrant],
    });
  });

  test("grants never admit an item canViewItem denies", () => {
    // Mirrors canViewItem: only standard items are reachable via a public
    // room, and a sensitive item's share link is paused.
    expect(itemViewableWhere(null).OR).toEqual([
      expect.objectContaining({ privacy: { not: "sensitive" } }),
      expect.objectContaining({ privacy: "standard" }),
    ]);
  });
});

describe("canViewItemHighlights", () => {
  test("owner sees highlights regardless of sharedHighlights", () => {
    expect(
      canViewItemHighlights({ userId: OWNER, sharedHighlights: false }, OWNER),
    ).toBe(true);
  });

  test("non-owner sees highlights only when sharedHighlights is on", () => {
    expect(
      canViewItemHighlights({ userId: OWNER, sharedHighlights: true }, OTHER),
    ).toBe(true);
    expect(
      canViewItemHighlights({ userId: OWNER, sharedHighlights: false }, OTHER),
    ).toBe(false);
  });

  test("signed-out viewer follows the sharedHighlights flag", () => {
    expect(
      canViewItemHighlights({ userId: OWNER, sharedHighlights: true }, null),
    ).toBe(true);
    expect(
      canViewItemHighlights({ userId: OWNER, sharedHighlights: false }, null),
    ).toBe(false);
  });
});
