import type { ItemImageDetails, ItemKind, ItemLocation } from "@prisma/client";
import type { Filter } from "../search/types";
import { itemMatchesRoom } from "./room-matcher";
import {
  hasValidFilters,
  type ItemWithDetails,
  type RoomWithFilters,
} from "./types";

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
 * Helper to create a filter for testing.
 */
let filterId = 0;
function createFilter(
  type: Filter["type"],
  value: string,
  options: {
    negated?: boolean;
    dateOperator?: Filter["dateOperator"];
    endDate?: string;
  } = {},
): Filter {
  return {
    id: `test-filter-${filterId++}`,
    type,
    value,
    negated: options.negated ?? false,
    dateOperator: options.dateOperator,
    endDate: options.endDate,
  };
}

/**
 * Factory function to create a test room with default values.
 */
function createTestRoom(
  filters: Filter[] | null,
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

  it("returns false for empty filters array", () => {
    expect(hasValidFilters([])).toBe(false);
  });

  it("returns true when filter exists", () => {
    expect(hasValidFilters([createFilter("type", "image")])).toBe(true);
  });

  it("returns true with multiple filters", () => {
    expect(
      hasValidFilters([
        createFilter("tag", "travel"),
        createFilter("type", "image"),
      ]),
    ).toBe(true);
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
      const room = createTestRoom([createFilter("type", "image")]);
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("returns false for items excluded from public rooms when room is public", () => {
      const item = createTestItem({
        excludeFromPublicRooms: true,
        kind: "image",
      });
      const room = createTestRoom([createFilter("type", "image")], {
        visibility: "public",
      });
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("returns true for items excluded from public rooms when room is private", () => {
      const item = createTestItem({
        excludeFromPublicRooms: true,
        kind: "image",
      });
      const room = createTestRoom([createFilter("type", "image")], {
        visibility: "private",
      });
      expect(itemMatchesRoom(item, room)).toBe(true);
    });
  });

  describe("type filter", () => {
    it("matches item kind", () => {
      const item = createTestItem({ kind: "image" });
      const room = createTestRoom([createFilter("type", "image")]);
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("is case-insensitive", () => {
      const item = createTestItem({ kind: "image" });
      const room = createTestRoom([createFilter("type", "IMAGE")]);
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("does not match different kind", () => {
      const item = createTestItem({ kind: "image" });
      const room = createTestRoom([createFilter("type", "article")]);
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("handles negated type filter", () => {
      const item = createTestItem({ kind: "image" });
      const room = createTestRoom([
        createFilter("type", "image", { negated: true }),
      ]);
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("handles negated type filter when not matching", () => {
      const item = createTestItem({ kind: "image" });
      const room = createTestRoom([
        createFilter("type", "article", { negated: true }),
      ]);
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("handles null kind", () => {
      const item = createTestItem({ kind: null });
      const room = createTestRoom([createFilter("type", "image")]);
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("ignores invalid type values", () => {
      const item = createTestItem({ kind: "image" });
      const room = createTestRoom([createFilter("type", "invalid")]);
      // Invalid filter value is ignored, so item matches (no valid filters)
      expect(itemMatchesRoom(item, room)).toBe(true);
    });
  });

  describe("tag filter", () => {
    it("matches item with tag", () => {
      const item = createTestItem({ tags: ["travel", "vacation"] });
      const room = createTestRoom([createFilter("tag", "travel")]);
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("is case-insensitive", () => {
      const item = createTestItem({ tags: ["Travel"] });
      const room = createTestRoom([createFilter("tag", "travel")]);
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("does not match item without tag", () => {
      const item = createTestItem({ tags: ["food"] });
      const room = createTestRoom([createFilter("tag", "travel")]);
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("handles negated tag filter", () => {
      const item = createTestItem({ tags: ["work"] });
      const room = createTestRoom([
        createFilter("tag", "work", { negated: true }),
      ]);
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("handles multiple tags with AND logic", () => {
      const item = createTestItem({ tags: ["travel", "vacation"] });
      const room = createTestRoom([
        createFilter("tag", "travel"),
        createFilter("tag", "vacation"),
      ]);
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("fails when one of multiple tags is missing", () => {
      const item = createTestItem({ tags: ["travel"] });
      const room = createTestRoom([
        createFilter("tag", "travel"),
        createFilter("tag", "vacation"),
      ]);
      expect(itemMatchesRoom(item, room)).toBe(false);
    });
  });

  describe("object filter", () => {
    it("matches item with detected object", () => {
      const item = createTestItem({
        imageDetails: createImageDetails({ objects: ["car", "tree"] }),
      });
      const room = createTestRoom([createFilter("object", "car")]);
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("is case-insensitive", () => {
      const item = createTestItem({
        imageDetails: createImageDetails({ objects: ["Car"] }),
      });
      const room = createTestRoom([createFilter("object", "car")]);
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("does not match item without object", () => {
      const item = createTestItem({
        imageDetails: createImageDetails({ objects: ["person"] }),
      });
      const room = createTestRoom([createFilter("object", "car")]);
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("handles item without imageDetails", () => {
      const item = createTestItem({ imageDetails: null });
      const room = createTestRoom([createFilter("object", "car")]);
      expect(itemMatchesRoom(item, room)).toBe(false);
    });
  });

  describe("source filter", () => {
    it("matches item source type", () => {
      const item = createTestItem({ sourceType: "upload" });
      const room = createTestRoom([createFilter("source", "upload")]);
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("is case-insensitive", () => {
      const item = createTestItem({ sourceType: "upload" });
      const room = createTestRoom([createFilter("source", "UPLOAD")]);
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("does not match different source", () => {
      const item = createTestItem({ sourceType: "upload" });
      const room = createTestRoom([createFilter("source", "url")]);
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("handles null sourceType", () => {
      const item = createTestItem({ sourceType: null });
      const room = createTestRoom([createFilter("source", "upload")]);
      expect(itemMatchesRoom(item, room)).toBe(false);
    });
  });

  describe("location filter", () => {
    it("matches item by city", () => {
      const item = createTestItem({
        locations: [createLocation({ city: "London" })],
      });
      const room = createTestRoom([createFilter("location", "London")]);
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("matches item by country", () => {
      const item = createTestItem({
        locations: [createLocation({ country: "United Kingdom" })],
      });
      const room = createTestRoom([createFilter("location", "United Kingdom")]);
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("is case-insensitive", () => {
      const item = createTestItem({
        locations: [createLocation({ city: "London" })],
      });
      const room = createTestRoom([createFilter("location", "london")]);
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("does not match different location", () => {
      const item = createTestItem({
        locations: [createLocation({ city: "London" })],
      });
      const room = createTestRoom([createFilter("location", "Paris")]);
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("handles item without locations", () => {
      const item = createTestItem({ locations: [] });
      const room = createTestRoom([createFilter("location", "London")]);
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
      const room = createTestRoom([createFilter("color", "red")]);
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("is case-insensitive", () => {
      const item = createTestItem({
        imageDetails: createImageDetails({
          colors: [{ name: "Red", hex: "#FF0000" }],
        }),
      });
      const room = createTestRoom([createFilter("color", "red")]);
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("does not match different color", () => {
      const item = createTestItem({
        imageDetails: createImageDetails({
          colors: [{ name: "blue", hex: "#0000FF" }],
        }),
      });
      const room = createTestRoom([createFilter("color", "red")]);
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("handles item without colors", () => {
      const item = createTestItem({
        imageDetails: createImageDetails({ colors: [] }),
      });
      const room = createTestRoom([createFilter("color", "red")]);
      expect(itemMatchesRoom(item, room)).toBe(false);
    });
  });

  describe("date filters", () => {
    it("matches item after date with 'after' operator", () => {
      const item = createTestItem({ createdAt: new Date("2024-06-15") });
      const room = createTestRoom([
        createFilter("date", "2024-01-01", { dateOperator: "after" }),
      ]);
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("does not match item before date with 'after' operator", () => {
      const item = createTestItem({ createdAt: new Date("2023-06-15") });
      const room = createTestRoom([
        createFilter("date", "2024-01-01", { dateOperator: "after" }),
      ]);
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("matches item before date with 'before' operator", () => {
      const item = createTestItem({ createdAt: new Date("2024-06-15") });
      const room = createTestRoom([
        createFilter("date", "2024-12-31", { dateOperator: "before" }),
      ]);
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("does not match item after date with 'before' operator", () => {
      const item = createTestItem({ createdAt: new Date("2025-06-15") });
      const room = createTestRoom([
        createFilter("date", "2024-12-31", { dateOperator: "before" }),
      ]);
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("matches item within date range using 'between' operator", () => {
      const item = createTestItem({ createdAt: new Date("2024-06-15") });
      const room = createTestRoom([
        createFilter("date", "2024-01-01", {
          dateOperator: "between",
          endDate: "2024-12-31",
        }),
      ]);
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("does not match item outside date range using 'between' operator", () => {
      const item = createTestItem({ createdAt: new Date("2023-06-15") });
      const room = createTestRoom([
        createFilter("date", "2024-01-01", {
          dateOperator: "between",
          endDate: "2024-12-31",
        }),
      ]);
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("matches item within date range using multiple date filters (AND logic)", () => {
      const item = createTestItem({ createdAt: new Date("2024-06-15") });
      const room = createTestRoom([
        createFilter("date", "2024-01-01", { dateOperator: "after" }),
        createFilter("date", "2024-12-31", { dateOperator: "before" }),
      ]);
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("does not match item outside date range using multiple date filters", () => {
      const item = createTestItem({ createdAt: new Date("2023-06-15") });
      const room = createTestRoom([
        createFilter("date", "2024-01-01", { dateOperator: "after" }),
        createFilter("date", "2024-12-31", { dateOperator: "before" }),
      ]);
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("ignores invalid date strings", () => {
      const item = createTestItem({ createdAt: new Date("2024-06-15") });
      const room = createTestRoom([
        createFilter("date", "invalid-date", { dateOperator: "after" }),
      ]);
      expect(itemMatchesRoom(item, room)).toBe(true);
    });
  });

  describe("combined filters", () => {
    it("matches item with multiple filter types (AND logic)", () => {
      const item = createTestItem({
        kind: "image",
        tags: ["travel"],
        sourceType: "upload",
      });
      const room = createTestRoom([
        createFilter("type", "image"),
        createFilter("tag", "travel"),
        createFilter("source", "upload"),
      ]);
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("does not match when one filter fails", () => {
      const item = createTestItem({
        kind: "image",
        tags: ["food"], // Wrong tag
        sourceType: "upload",
      });
      const room = createTestRoom([
        createFilter("type", "image"),
        createFilter("tag", "travel"),
        createFilter("source", "upload"),
      ]);
      expect(itemMatchesRoom(item, room)).toBe(false);
    });

    it("handles complex combination with multiple filter types", () => {
      const item = createTestItem({
        kind: "image",
        tags: ["travel", "vacation"],
        sourceType: "upload",
        createdAt: new Date("2024-06-15"),
        locations: [createLocation({ city: "London" })],
      });
      const room = createTestRoom([
        createFilter("type", "image"),
        createFilter("tag", "travel"),
        createFilter("location", "London"),
        createFilter("date", "2024-01-01", { dateOperator: "after" }),
      ]);
      expect(itemMatchesRoom(item, room)).toBe(true);
    });

    it("fails complex combination when one filter does not match", () => {
      const item = createTestItem({
        kind: "image",
        tags: ["travel"],
        sourceType: "upload",
        createdAt: new Date("2023-06-15"), // Before the date filter
      });
      const room = createTestRoom([
        createFilter("type", "image"),
        createFilter("tag", "travel"),
        createFilter("date", "2024-01-01", { dateOperator: "after" }),
      ]);
      expect(itemMatchesRoom(item, room)).toBe(false);
    });
  });
});
