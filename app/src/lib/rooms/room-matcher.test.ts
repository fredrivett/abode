import type { ItemImageDetails, ItemKind, ItemLocation } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { hasValidFilters, itemMatchesRoom } from "./room-matcher";
import type { ItemWithDetails, RoomFilters, RoomWithFilters } from "./types";

/**
 * Create a complete ItemImageDetails object for testing.
 */
function createImageDetails(
  overrides: Partial<ItemImageDetails> = {},
): ItemImageDetails {
  return {
    itemId: "test-item-id",
    objects: [],
    colors: null,
    ocrText: null,
    visionData: null,
    captureDate: null,
    createdAt: new Date("2024-06-15"),
    updatedAt: new Date("2024-06-15"),
    ...overrides,
  };
}

/**
 * Create a complete ItemLocation object for testing.
 */
function createLocation(overrides: Partial<ItemLocation> = {}): ItemLocation {
  return {
    id: `location-${Math.random().toString(36).substring(7)}`,
    itemId: "test-item-id",
    userId: "test-user-id",
    source: "exif",
    latitude: 51.5074,
    longitude: -0.1278,
    neighborhood: "Westminster",
    city: "London",
    region: "England",
    country: "United Kingdom",
    countryCode: "GB",
    formatted: "Westminster, London, England, United Kingdom",
    raw: null,
    createdAt: new Date("2024-06-15"),
    updatedAt: new Date("2024-06-15"),
    ...overrides,
  };
}

/**
 * Factory function to create a test item with default values.
 */
function createTestItem(
  overrides: {
    id?: string;
    userId?: string;
    kind?: ItemKind | null;
    processingStatus?: string;
    tags?: string[];
    sourceType?: string | null;
    createdAt?: Date;
    deletedAt?: Date | null;
    excludeFromPublicRooms?: boolean;
    imageDetails?: ItemImageDetails | null;
    locations?: ItemLocation[];
  } = {},
): ItemWithDetails {
  return {
    id: overrides.id ?? "test-item-id",
    userId: overrides.userId ?? "test-user-id",
    kind: "kind" in overrides ? overrides.kind : "image",
    processingStatus: overrides.processingStatus ?? "completed",
    fileKey: "test-file-key",
    meta: null,
    sourceType: "sourceType" in overrides ? overrides.sourceType : "upload",
    sourceUrl: null,
    coverFileKey: null,
    createdAt: overrides.createdAt ?? new Date("2024-06-15"),
    updatedAt: new Date("2024-06-15"),
    title: null,
    description: null,
    tags: overrides.tags ?? [],
    deletedAt: overrides.deletedAt ?? null,
    excludeFromPublicRooms: overrides.excludeFromPublicRooms ?? false,
    imageDetails: overrides.imageDetails ?? null,
    locations: overrides.locations ?? [],
  } as ItemWithDetails;
}

/**
 * Factory function to create a test room with default values.
 */
function createTestRoom(
  filters: RoomFilters | null,
  overrides: Partial<RoomWithFilters> = {},
): RoomWithFilters {
  return {
    id: "test-room-id",
    userId: "test-user-id",
    name: "Test Room",
    type: "smart",
    filters,
    visibility: "private",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("hasValidFilters", () => {
  it("returns false for null filters", () => {
    expect(hasValidFilters(null)).toBe(false);
  });

  it("returns false for empty filters object", () => {
    expect(hasValidFilters({})).toBe(false);
  });

  it("returns true when type filter exists", () => {
    expect(
      hasValidFilters({ type: [{ value: "image", negated: false }] }),
    ).toBe(true);
  });

  it("returns true when tag filter exists", () => {
    expect(
      hasValidFilters({ tag: [{ value: "travel", negated: false }] }),
    ).toBe(true);
  });

  it("returns true when object filter exists", () => {
    expect(
      hasValidFilters({ object: [{ value: "car", negated: false }] }),
    ).toBe(true);
  });

  it("returns true when color filter exists", () => {
    expect(hasValidFilters({ color: [{ value: "red", negated: false }] })).toBe(
      true,
    );
  });

  it("returns true when source filter exists", () => {
    expect(
      hasValidFilters({ source: [{ value: "upload", negated: false }] }),
    ).toBe(true);
  });

  it("returns true when location filter exists", () => {
    expect(
      hasValidFilters({ location: [{ value: "London", negated: false }] }),
    ).toBe(true);
  });

  it("returns true when dateAfter filter exists", () => {
    expect(hasValidFilters({ dateAfter: "2024-01-01" })).toBe(true);
  });

  it("returns true when dateBefore filter exists", () => {
    expect(hasValidFilters({ dateBefore: "2024-12-31" })).toBe(true);
  });

  it("returns false when arrays are empty", () => {
    expect(hasValidFilters({ type: [], tag: [], object: [] })).toBe(false);
  });
});

describe("itemMatchesRoom", () => {
  describe("basic matching", () => {
    it("returns false when room has no filters", () => {
      const item = createTestItem();
      const room = createTestRoom(null);
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("returns false for soft-deleted items", () => {
      const item = createTestItem({ deletedAt: new Date() });
      const room = createTestRoom({
        type: [{ value: "image", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("returns false for items excluded from public rooms when room is public", () => {
      const item = createTestItem({
        excludeFromPublicRooms: true,
        kind: "image",
      });
      const room = createTestRoom(
        { type: [{ value: "image", negated: false }] },
        { visibility: "public" },
      );
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("returns true for items excluded from public rooms when room is private", () => {
      const item = createTestItem({
        excludeFromPublicRooms: true,
        kind: "image",
      });
      const room = createTestRoom(
        { type: [{ value: "image", negated: false }] },
        { visibility: "private" },
      );
      expect(itemMatchesRoom(item, room)).toBe(true);
    });
  });

  describe("type filter", () => {
    it("matches item kind", () => {
      const item = createTestItem({ kind: "image" });
      const room = createTestRoom({
        type: [{ value: "image", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("is case-insensitive", () => {
      const item = createTestItem({ kind: "image" });
      const room = createTestRoom({
        type: [{ value: "IMAGE", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("does not match different kind", () => {
      const item = createTestItem({ kind: "image" });
      const room = createTestRoom({
        type: [{ value: "article", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("handles negated type filter", () => {
      const item = createTestItem({ kind: "image" });
      const room = createTestRoom({
        type: [{ value: "image", negated: true }],
      });
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("handles negated type filter when not matching", () => {
      const item = createTestItem({ kind: "image" });
      const room = createTestRoom({
        type: [{ value: "article", negated: true }],
      });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("handles null kind", () => {
      const item = createTestItem({ kind: null });
      const room = createTestRoom({
        type: [{ value: "image", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("ignores invalid type values", () => {
      const item = createTestItem({ kind: "image" });
      const room = createTestRoom({
        type: [{ value: "invalid", negated: false }],
      });
      // Invalid filter value is ignored, so item matches (no valid filters)
      expect(itemMatchesRoom(item, room)).toBe(true);
    });
  });

  describe("tag filter", () => {
    it("matches item with tag", () => {
      const item = createTestItem({ tags: ["travel", "vacation"] });
      const room = createTestRoom({
        tag: [{ value: "travel", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("is case-insensitive", () => {
      const item = createTestItem({ tags: ["Travel"] });
      const room = createTestRoom({
        tag: [{ value: "travel", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("does not match item without tag", () => {
      const item = createTestItem({ tags: ["food"] });
      const room = createTestRoom({
        tag: [{ value: "travel", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("handles negated tag filter", () => {
      const item = createTestItem({ tags: ["work"] });
      const room = createTestRoom({ tag: [{ value: "work", negated: true }] });
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("handles multiple tags with AND logic", () => {
      const item = createTestItem({ tags: ["travel", "vacation"] });
      const room = createTestRoom({
        tag: [
          { value: "travel", negated: false },
          { value: "vacation", negated: false },
        ],
      });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("fails when one of multiple tags is missing", () => {
      const item = createTestItem({ tags: ["travel"] });
      const room = createTestRoom({
        tag: [
          { value: "travel", negated: false },
          { value: "vacation", negated: false },
        ],
      });
      expect(itemMatchesRoom(item, room)).toBe(false);
    });
  });

  describe("object filter", () => {
    it("matches item with detected object", () => {
      const item = createTestItem({
        imageDetails: createImageDetails({ objects: ["car", "tree"] }),
      });
      const room = createTestRoom({
        object: [{ value: "car", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("is case-insensitive", () => {
      const item = createTestItem({
        imageDetails: createImageDetails({ objects: ["Car"] }),
      });
      const room = createTestRoom({
        object: [{ value: "car", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("does not match item without object", () => {
      const item = createTestItem({
        imageDetails: createImageDetails({ objects: ["person"] }),
      });
      const room = createTestRoom({
        object: [{ value: "car", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("handles item without imageDetails", () => {
      const item = createTestItem({ imageDetails: null });
      const room = createTestRoom({
        object: [{ value: "car", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(false);
    });
  });

  describe("source filter", () => {
    it("matches item source type", () => {
      const item = createTestItem({ sourceType: "upload" });
      const room = createTestRoom({
        source: [{ value: "upload", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("is case-insensitive", () => {
      const item = createTestItem({ sourceType: "upload" });
      const room = createTestRoom({
        source: [{ value: "UPLOAD", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("does not match different source", () => {
      const item = createTestItem({ sourceType: "upload" });
      const room = createTestRoom({
        source: [{ value: "url", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("handles null sourceType", () => {
      const item = createTestItem({ sourceType: null });
      const room = createTestRoom({
        source: [{ value: "upload", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(false);
    });
  });

  describe("location filter", () => {
    it("matches item by city", () => {
      const item = createTestItem({
        locations: [createLocation({ city: "London" })],
      });
      const room = createTestRoom({
        location: [{ value: "London", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("matches item by country", () => {
      const item = createTestItem({
        locations: [createLocation({ country: "United Kingdom" })],
      });
      const room = createTestRoom({
        location: [{ value: "United Kingdom", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("is case-insensitive", () => {
      const item = createTestItem({
        locations: [createLocation({ city: "London" })],
      });
      const room = createTestRoom({
        location: [{ value: "london", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("does not match different location", () => {
      const item = createTestItem({
        locations: [createLocation({ city: "London" })],
      });
      const room = createTestRoom({
        location: [{ value: "Paris", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("handles item without locations", () => {
      const item = createTestItem({ locations: [] });
      const room = createTestRoom({
        location: [{ value: "London", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(false);
    });
  });

  describe("color filter", () => {
    it("matches item with color name", () => {
      const item = createTestItem({
        imageDetails: createImageDetails({
          colors: [{ name: "red", hex: "#FF0000" }],
        }),
      });
      const room = createTestRoom({
        color: [{ value: "red", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("is case-insensitive", () => {
      const item = createTestItem({
        imageDetails: createImageDetails({
          colors: [{ name: "Red", hex: "#FF0000" }],
        }),
      });
      const room = createTestRoom({
        color: [{ value: "red", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("does not match different color", () => {
      const item = createTestItem({
        imageDetails: createImageDetails({
          colors: [{ name: "blue", hex: "#0000FF" }],
        }),
      });
      const room = createTestRoom({
        color: [{ value: "red", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("handles item without colors", () => {
      const item = createTestItem({
        imageDetails: createImageDetails({ colors: [] }),
      });
      const room = createTestRoom({
        color: [{ value: "red", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(false);
    });
  });

  describe("date filters", () => {
    it("matches item after dateAfter", () => {
      const item = createTestItem({ createdAt: new Date("2024-06-15") });
      const room = createTestRoom({ dateAfter: "2024-01-01" });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("does not match item before dateAfter", () => {
      const item = createTestItem({ createdAt: new Date("2023-06-15") });
      const room = createTestRoom({ dateAfter: "2024-01-01" });
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("matches item before dateBefore", () => {
      const item = createTestItem({ createdAt: new Date("2024-06-15") });
      const room = createTestRoom({ dateBefore: "2024-12-31" });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("does not match item after dateBefore", () => {
      const item = createTestItem({ createdAt: new Date("2025-06-15") });
      const room = createTestRoom({ dateBefore: "2024-12-31" });
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("matches item within date range", () => {
      const item = createTestItem({ createdAt: new Date("2024-06-15") });
      const room = createTestRoom({
        dateAfter: "2024-01-01",
        dateBefore: "2024-12-31",
      });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("does not match item outside date range", () => {
      const item = createTestItem({ createdAt: new Date("2023-06-15") });
      const room = createTestRoom({
        dateAfter: "2024-01-01",
        dateBefore: "2024-12-31",
      });
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("ignores invalid date strings", () => {
      const item = createTestItem({ createdAt: new Date("2024-06-15") });
      const room = createTestRoom({ dateAfter: "invalid-date" });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });
  });

  describe("OR groups", () => {
    it("matches when any item in OR group matches", () => {
      const item = createTestItem({ kind: "image" });
      const room = createTestRoom({
        type: [
          { value: "image", negated: false, orGroup: 0 },
          { value: "article", negated: false, orGroup: 0 },
        ],
      });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("matches second option in OR group", () => {
      const item = createTestItem({ kind: "article" });
      const room = createTestRoom({
        type: [
          { value: "image", negated: false, orGroup: 0 },
          { value: "article", negated: false, orGroup: 0 },
        ],
      });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("does not match when none in OR group match", () => {
      // Using null kind to test when item doesn't match either option in OR group
      const item = createTestItem({ kind: null });
      const room = createTestRoom({
        type: [
          { value: "image", negated: false, orGroup: 0 },
          { value: "article", negated: false, orGroup: 0 },
        ],
      });
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("handles mixed OR groups and regular filters", () => {
      const item = createTestItem({ kind: "image", tags: ["travel"] });
      const room = createTestRoom({
        type: [
          { value: "image", negated: false, orGroup: 0 },
          { value: "article", negated: false, orGroup: 0 },
        ],
        tag: [{ value: "travel", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("fails when OR group matches but regular filter does not", () => {
      const item = createTestItem({ kind: "image", tags: ["food"] });
      const room = createTestRoom({
        type: [
          { value: "image", negated: false, orGroup: 0 },
          { value: "article", negated: false, orGroup: 0 },
        ],
        tag: [{ value: "travel", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(false);
    });
  });

  describe("combined filters", () => {
    it("matches item with multiple filter types (AND logic)", () => {
      const item = createTestItem({
        kind: "image",
        tags: ["travel"],
        sourceType: "upload",
      });
      const room = createTestRoom({
        type: [{ value: "image", negated: false }],
        tag: [{ value: "travel", negated: false }],
        source: [{ value: "upload", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("does not match when one filter fails", () => {
      const item = createTestItem({
        kind: "image",
        tags: ["food"], // Wrong tag
        sourceType: "upload",
      });
      const room = createTestRoom({
        type: [{ value: "image", negated: false }],
        tag: [{ value: "travel", negated: false }],
        source: [{ value: "upload", negated: false }],
      });
      expect(itemMatchesRoom(item, room)).toBe(false);
    });
  });
});
