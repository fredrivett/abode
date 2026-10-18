import { ItemPrivacy } from "@prisma/client";
import { describe, expect, test } from "vitest";
import {
  allowsPublicRooms,
  allowsShareLink,
  ITEM_PRIVACY_LEVELS,
  isItemPrivacy,
  isSensitive,
  stricterPrivacy,
} from "./privacy";

describe("ITEM_PRIVACY_LEVELS", () => {
  test("lists every Prisma level in ladder (declaration) order", () => {
    // stricterPrivacy relies on this order matching the Postgres enum
    expect([...ITEM_PRIVACY_LEVELS]).toEqual(Object.values(ItemPrivacy));
  });
});

describe("isItemPrivacy", () => {
  test.each(ITEM_PRIVACY_LEVELS)("accepts %s", (level) => {
    expect(isItemPrivacy(level)).toBe(true);
  });

  test.each(["private", "", null, undefined, 1])("rejects %s", (value) => {
    expect(isItemPrivacy(value)).toBe(false);
  });
});

describe("stricterPrivacy", () => {
  test.each([
    ["standard", "unlisted", "unlisted"],
    ["standard", "sensitive", "sensitive"],
    ["unlisted", "sensitive", "sensitive"],
    ["sensitive", "standard", "sensitive"],
    ["unlisted", "standard", "unlisted"],
    ["unlisted", "unlisted", "unlisted"],
  ] as const)(
    "current %s + candidate %s → %s",
    (current, candidate, expected) => {
      expect(stricterPrivacy({ current, candidate })).toBe(expected);
    },
  );
});

describe("ladder predicates", () => {
  test.each([
    ["standard", true, true, false],
    ["unlisted", false, true, false],
    ["sensitive", false, false, true],
  ] as const)(
    "%s: public rooms %s, share link %s, sensitive %s",
    (level, rooms, share, sensitive) => {
      expect(allowsPublicRooms(level)).toBe(rooms);
      expect(allowsShareLink(level)).toBe(share);
      expect(isSensitive(level)).toBe(sensitive);
    },
  );
});
