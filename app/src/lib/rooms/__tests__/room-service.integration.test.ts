/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import type { Prisma } from "@prisma/client";

describe("Room Service Integration", () => {
  // Reset the database before each test to ensure isolation
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const createTestUser = async (email = "test@example.com") => {
    const { write } = await import("@/lib/db");
    return write.user.create({
      data: {
        id: crypto.randomUUID(),
        email,
      },
    });
  };

  const createTestItem = async (
    userId: string,
    overrides: {
      kind?: "image" | "article";
      tags?: string[];
      sourceType?: "upload" | "url";
      deletedAt?: Date | null;
      excludeFromPublicRooms?: boolean;
    } = {},
  ) => {
    const { write } = await import("@/lib/db");
    return write.item.create({
      data: {
        userId,
        kind: overrides.kind ?? "image",
        sourceType: overrides.sourceType ?? "upload",
        tags: overrides.tags ?? [],
        deletedAt: overrides.deletedAt ?? null,
        excludeFromPublicRooms: overrides.excludeFromPublicRooms ?? false,
      },
    });
  };

  const createTestRoom = async (
    userId: string,
    overrides: {
      name?: string;
      type?: "smart" | "manual";
      filters?: Prisma.InputJsonValue;
      visibility?: "private" | "public";
    } = {},
  ) => {
    const { write } = await import("@/lib/db");
    return write.room.create({
      data: {
        userId,
        name: overrides.name ?? "Test Room",
        type: overrides.type ?? "smart",
        filters: overrides.filters ?? {
          tag: [{ value: "test", negated: false }],
        },
        visibility: overrides.visibility ?? "private",
      },
    });
  };

  describe("getUserSmartRooms", () => {
    it("returns only smart rooms for the user", async () => {
      const user = await createTestUser();
      const { getUserSmartRooms } = await import("@/lib/rooms/room-service");

      // Create a smart room and a manual room
      await createTestRoom(user.id, { type: "smart", name: "Smart Room" });
      await createTestRoom(user.id, { type: "manual", name: "Manual Room" });

      const rooms = await getUserSmartRooms(user.id);

      expect(rooms).toHaveLength(1);
      expect(rooms[0].name).toBe("Smart Room");
      expect(rooms[0].type).toBe("smart");
    });

    it("returns rooms with typed filters", async () => {
      const user = await createTestUser();
      const { getUserSmartRooms } = await import("@/lib/rooms/room-service");

      await createTestRoom(user.id, {
        filters: {
          tag: [{ value: "travel", negated: false }],
          type: [{ value: "image", negated: false }],
        },
      });

      const rooms = await getUserSmartRooms(user.id);

      expect(rooms[0].filters).toEqual({
        tag: [{ value: "travel", negated: false }],
        type: [{ value: "image", negated: false }],
      });
    });

    it("returns empty array when user has no smart rooms", async () => {
      const user = await createTestUser();
      const { getUserSmartRooms } = await import("@/lib/rooms/room-service");

      const rooms = await getUserSmartRooms(user.id);

      expect(rooms).toEqual([]);
    });
  });

  describe("getSmartRoomCount", () => {
    it("counts only smart rooms", async () => {
      const user = await createTestUser();
      const { getSmartRoomCount } = await import("@/lib/rooms/room-service");

      await createTestRoom(user.id, { type: "smart" });
      await createTestRoom(user.id, { type: "smart" });
      await createTestRoom(user.id, { type: "manual" });

      const count = await getSmartRoomCount(user.id);

      expect(count).toBe(2);
    });
  });

  describe("canCreateSmartRoom", () => {
    it("returns true when under limit", async () => {
      const user = await createTestUser();
      const { canCreateSmartRoom, MAX_SMART_ROOMS_PER_USER } = await import(
        "@/lib/rooms/room-service"
      );

      // Create fewer rooms than the limit
      for (let i = 0; i < MAX_SMART_ROOMS_PER_USER - 1; i++) {
        await createTestRoom(user.id, { type: "smart", name: `Room ${i}` });
      }

      const canCreate = await canCreateSmartRoom(user.id);

      expect(canCreate).toBe(true);
    });

    it("returns false when at limit", async () => {
      const user = await createTestUser();
      const { canCreateSmartRoom, MAX_SMART_ROOMS_PER_USER } = await import(
        "@/lib/rooms/room-service"
      );

      // Create exactly the limit of rooms
      for (let i = 0; i < MAX_SMART_ROOMS_PER_USER; i++) {
        await createTestRoom(user.id, { type: "smart", name: `Room ${i}` });
      }

      const canCreate = await canCreateSmartRoom(user.id);

      expect(canCreate).toBe(false);
    });
  });

  describe("loadItemWithDetails", () => {
    it("returns item with imageDetails and locations", async () => {
      const user = await createTestUser();
      const { write } = await import("@/lib/db");
      const { loadItemWithDetails } = await import("@/lib/rooms/room-service");

      const item = await write.item.create({
        data: {
          userId: user.id,
          kind: "image",
          sourceType: "upload",
          tags: ["test"],
          imageDetails: {
            create: {
              objects: ["tree", "sky"],
              colors: [{ name: "blue" }],
            },
          },
          locations: {
            create: {
              source: "exif",
              city: "Paris",
              country: "France",
              userId: user.id,
            },
          },
        },
      });

      const loadedItem = await loadItemWithDetails(item.id, user.id);

      expect(loadedItem).not.toBeNull();
      expect(loadedItem?.imageDetails?.objects).toEqual(["tree", "sky"]);
      expect(loadedItem?.locations).toHaveLength(1);
      expect(loadedItem?.locations[0].city).toBe("Paris");
    });

    it("returns null for non-existent item", async () => {
      const user = await createTestUser();
      const { loadItemWithDetails } = await import("@/lib/rooms/room-service");

      // Use a valid UUID format for non-existent item
      const loadedItem = await loadItemWithDetails(
        "00000000-0000-0000-0000-000000000000",
        user.id,
      );

      expect(loadedItem).toBeNull();
    });

    it("returns null for item belonging to different user", async () => {
      const user1 = await createTestUser("user1@example.com");
      const user2 = await createTestUser("user2@example.com");
      const { loadItemWithDetails } = await import("@/lib/rooms/room-service");

      const item = await createTestItem(user1.id);

      const loadedItem = await loadItemWithDetails(item.id, user2.id);

      expect(loadedItem).toBeNull();
    });
  });

  describe("loadUserItemsWithDetails", () => {
    it("returns only non-deleted items", async () => {
      const user = await createTestUser();
      const { loadUserItemsWithDetails } = await import(
        "@/lib/rooms/room-service"
      );

      await createTestItem(user.id, { tags: ["active"] });
      await createTestItem(user.id, {
        tags: ["deleted"],
        deletedAt: new Date(),
      });

      const items = await loadUserItemsWithDetails(user.id);

      expect(items).toHaveLength(1);
      expect(items[0].tags).toContain("active");
    });
  });

  describe("syncItemToRooms", () => {
    it("adds item to matching rooms", async () => {
      const user = await createTestUser();
      const { read } = await import("@/lib/db");
      const { syncItemToRooms } = await import("@/lib/rooms/room-service");

      // Create a room that filters for "travel" tag
      const room = await createTestRoom(user.id, {
        filters: { tag: [{ value: "travel", negated: false }] },
      });

      // Create an item with matching tag
      const item = await createTestItem(user.id, { tags: ["travel"] });

      const result = await syncItemToRooms(item.id, user.id);

      expect(result.added).toBe(1);
      expect(result.removed).toBe(0);

      // Verify item is in the room
      const roomItems = await read.roomItem.findMany({
        where: { roomId: room.id },
      });
      expect(roomItems).toHaveLength(1);
      expect(roomItems[0].itemId).toBe(item.id);
    });

    it("removes item from non-matching rooms", async () => {
      const user = await createTestUser();
      const { write, read } = await import("@/lib/db");
      const { syncItemToRooms } = await import("@/lib/rooms/room-service");

      // Create a room and item
      const room = await createTestRoom(user.id, {
        filters: { tag: [{ value: "travel", negated: false }] },
      });
      const item = await createTestItem(user.id, { tags: ["food"] });

      // Manually add item to room
      await write.roomItem.create({
        data: { roomId: room.id, itemId: item.id },
      });

      // Verify it was added
      const before = await read.roomItem.findMany({
        where: { roomId: room.id },
      });
      expect(before).toHaveLength(1);

      // Sync - should remove since tags don't match
      const result = await syncItemToRooms(item.id, user.id);

      expect(result.removed).toBe(1);
      expect(result.added).toBe(0);

      // Verify item was removed
      const after = await read.roomItem.findMany({
        where: { roomId: room.id },
      });
      expect(after).toHaveLength(0);
    });

    it("does not add to manual rooms", async () => {
      const user = await createTestUser();
      const { read } = await import("@/lib/db");
      const { syncItemToRooms } = await import("@/lib/rooms/room-service");

      // Create a manual room
      const room = await createTestRoom(user.id, { type: "manual" });
      const item = await createTestItem(user.id, { tags: ["test"] });

      const result = await syncItemToRooms(item.id, user.id);

      expect(result.added).toBe(0);

      // Verify item is not in the room
      const roomItems = await read.roomItem.findMany({
        where: { roomId: room.id },
      });
      expect(roomItems).toHaveLength(0);
    });

    it("returns zeros for non-existent item", async () => {
      const user = await createTestUser();
      const { syncItemToRooms } = await import("@/lib/rooms/room-service");

      // Use a valid UUID format for non-existent item
      const result = await syncItemToRooms(
        "00000000-0000-0000-0000-000000000000",
        user.id,
      );

      expect(result).toEqual({ added: 0, removed: 0 });
    });
  });

  describe("syncRoomItems", () => {
    it("adds matching items to room", async () => {
      const user = await createTestUser();
      const { read } = await import("@/lib/db");
      const { syncRoomItems } = await import("@/lib/rooms/room-service");

      // Create items
      await createTestItem(user.id, { tags: ["travel"] });
      await createTestItem(user.id, { tags: ["travel", "europe"] });
      await createTestItem(user.id, { tags: ["food"] });

      // Create room filtering for "travel"
      const room = await createTestRoom(user.id, {
        filters: { tag: [{ value: "travel", negated: false }] },
      });

      const result = await syncRoomItems(room.id, user.id);

      expect(result.added).toBe(2);
      expect(result.removed).toBe(0);

      // Verify items in room
      const roomItems = await read.roomItem.findMany({
        where: { roomId: room.id },
      });
      expect(roomItems).toHaveLength(2);
    });

    it("removes non-matching items from room", async () => {
      const user = await createTestUser();
      const { write, read } = await import("@/lib/db");
      const { syncRoomItems } = await import("@/lib/rooms/room-service");

      // Create items
      const matchingItem = await createTestItem(user.id, { tags: ["travel"] });
      const nonMatchingItem = await createTestItem(user.id, { tags: ["food"] });

      // Create room
      const room = await createTestRoom(user.id, {
        filters: { tag: [{ value: "travel", negated: false }] },
      });

      // Manually add both items to room
      await write.roomItem.createMany({
        data: [
          { roomId: room.id, itemId: matchingItem.id },
          { roomId: room.id, itemId: nonMatchingItem.id },
        ],
      });

      const result = await syncRoomItems(room.id, user.id);

      expect(result.added).toBe(0);
      expect(result.removed).toBe(1);

      // Verify only matching item remains
      const roomItems = await read.roomItem.findMany({
        where: { roomId: room.id },
      });
      expect(roomItems).toHaveLength(1);
      expect(roomItems[0].itemId).toBe(matchingItem.id);
    });

    it("returns zeros for non-existent room", async () => {
      const user = await createTestUser();
      const { syncRoomItems } = await import("@/lib/rooms/room-service");

      // Use a valid UUID format for non-existent room
      const result = await syncRoomItems(
        "00000000-0000-0000-0000-000000000000",
        user.id,
      );

      expect(result).toEqual({ added: 0, removed: 0 });
    });

    it("returns zeros for manual room", async () => {
      const user = await createTestUser();
      const { syncRoomItems } = await import("@/lib/rooms/room-service");

      const room = await createTestRoom(user.id, { type: "manual" });

      const result = await syncRoomItems(room.id, user.id);

      expect(result).toEqual({ added: 0, removed: 0 });
    });

    it("excludes deleted items", async () => {
      const user = await createTestUser();
      const { read } = await import("@/lib/db");
      const { syncRoomItems } = await import("@/lib/rooms/room-service");

      // Create items (one active, one deleted)
      await createTestItem(user.id, { tags: ["travel"] });
      await createTestItem(user.id, {
        tags: ["travel"],
        deletedAt: new Date(),
      });

      // Create room filtering for "travel"
      const room = await createTestRoom(user.id, {
        filters: { tag: [{ value: "travel", negated: false }] },
      });

      const result = await syncRoomItems(room.id, user.id);

      expect(result.added).toBe(1);

      // Verify only non-deleted item in room
      const roomItems = await read.roomItem.findMany({
        where: { roomId: room.id },
      });
      expect(roomItems).toHaveLength(1);
    });
  });

  describe("getRoomById", () => {
    it("returns room with typed filters", async () => {
      const user = await createTestUser();
      const { getRoomById } = await import("@/lib/rooms/room-service");

      const room = await createTestRoom(user.id, {
        name: "Travel Photos",
        filters: {
          tag: [{ value: "travel", negated: false }],
          type: [{ value: "image", negated: false }],
        },
      });

      const fetchedRoom = await getRoomById(room.id, user.id);

      expect(fetchedRoom).not.toBeNull();
      expect(fetchedRoom?.name).toBe("Travel Photos");
      expect(fetchedRoom?.filters).toEqual({
        tag: [{ value: "travel", negated: false }],
        type: [{ value: "image", negated: false }],
      });
    });

    it("returns null for non-existent room", async () => {
      const user = await createTestUser();
      const { getRoomById } = await import("@/lib/rooms/room-service");

      // Use a valid UUID format for non-existent room
      const room = await getRoomById(
        "00000000-0000-0000-0000-000000000000",
        user.id,
      );

      expect(room).toBeNull();
    });

    it("returns null for room belonging to different user", async () => {
      const user1 = await createTestUser("user1@example.com");
      const user2 = await createTestUser("user2@example.com");
      const { getRoomById } = await import("@/lib/rooms/room-service");

      const room = await createTestRoom(user1.id);

      const fetchedRoom = await getRoomById(room.id, user2.id);

      expect(fetchedRoom).toBeNull();
    });
  });
});
