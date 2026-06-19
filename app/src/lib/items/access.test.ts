import { describe, expect, test } from "vitest";
import {
  canViewItem,
  canViewItemHighlights,
  type ItemAccessInput,
} from "./access";

const OWNER = "owner-id";
const OTHER = "other-id";

function makeItem(overrides: Partial<ItemAccessInput> = {}): ItemAccessInput {
  return {
    userId: OWNER,
    sharedAt: null,
    excludeFromPublicRooms: false,
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

  test("owner can view a private, excluded item", () => {
    const item = makeItem({
      excludeFromPublicRooms: true,
      roomItems: inRooms("private"),
    });
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

  test("non-owner cannot view a public-room item excluded from public rooms", () => {
    const item = makeItem({
      excludeFromPublicRooms: true,
      roomItems: inRooms("public"),
    });
    expect(canViewItem(item, OTHER)).toBe(false);
  });

  test("direct share overrides excludeFromPublicRooms and private rooms", () => {
    const item = makeItem({
      sharedAt: new Date(),
      excludeFromPublicRooms: true,
      roomItems: inRooms("private"),
    });
    expect(canViewItem(item, OTHER)).toBe(true);
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
