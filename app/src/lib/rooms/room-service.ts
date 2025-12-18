/**
 * Room service - handles room operations and item-room synchronization.
 */

import db from "@/lib/db";
import { itemMatchesRoom } from "./room-matcher";
import type { ItemWithDetails, RoomFilters, RoomWithFilters } from "./types";

/** Maximum number of smart rooms per user */
export const MAX_SMART_ROOMS_PER_USER = 5;

/**
 * Get all smart rooms for a user.
 */
export async function getUserSmartRooms(
  userId: string,
): Promise<RoomWithFilters[]> {
  const rooms = await db.room.findMany({
    where: {
      userId,
      type: "smart",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return rooms.map((room) => ({
    ...room,
    filters: room.filters as RoomFilters | null,
  }));
}

/**
 * Get the count of smart rooms for a user.
 */
export async function getSmartRoomCount(userId: string): Promise<number> {
  return db.room.count({
    where: {
      userId,
      type: "smart",
    },
  });
}

/**
 * Check if user can create another smart room.
 */
export async function canCreateSmartRoom(userId: string): Promise<boolean> {
  const count = await getSmartRoomCount(userId);
  return count < MAX_SMART_ROOMS_PER_USER;
}

/**
 * Load an item with all data needed for room matching.
 */
export async function loadItemWithDetails(
  itemId: string,
  userId: string,
): Promise<ItemWithDetails | null> {
  const item = await db.item.findUnique({
    where: {
      id: itemId,
      userId,
    },
    include: {
      imageDetails: true,
      locations: true,
    },
  });

  return item;
}

/**
 * Load all non-deleted items for a user with details needed for room matching.
 */
export async function loadUserItemsWithDetails(
  userId: string,
): Promise<ItemWithDetails[]> {
  const items = await db.item.findMany({
    where: {
      userId,
      deletedAt: null,
    },
    include: {
      imageDetails: true,
      locations: true,
    },
  });

  return items;
}

/**
 * Sync a single item to all of a user's smart rooms.
 * Adds item to rooms where it matches, removes from rooms where it doesn't.
 *
 * @returns Object with counts of additions and removals
 */
export async function syncItemToRooms(
  itemId: string,
  userId: string,
): Promise<{ added: number; removed: number }> {
  const item = await loadItemWithDetails(itemId, userId);
  if (!item) {
    return { added: 0, removed: 0 };
  }

  const rooms = await getUserSmartRooms(userId);
  let added = 0;
  let removed = 0;

  for (const room of rooms) {
    const matches = itemMatchesRoom(item, room);

    if (matches) {
      // Add to room if not already present
      // Use findFirst + create instead of upsert to reliably track new inserts
      const existing = await db.roomItem.findUnique({
        where: {
          roomId_itemId: {
            roomId: room.id,
            itemId: item.id,
          },
        },
      });

      if (!existing) {
        await db.roomItem.create({
          data: {
            roomId: room.id,
            itemId: item.id,
          },
        });
        added++;
      }
    } else {
      // Remove from room if present
      const result = await db.roomItem.deleteMany({
        where: {
          roomId: room.id,
          itemId: item.id,
        },
      });
      removed += result.count;
    }
  }

  return { added, removed };
}

/**
 * Re-sync all items for a room based on its filters.
 * Used when room filters are updated.
 *
 * @returns Object with counts of additions and removals
 */
export async function syncRoomItems(
  roomId: string,
  userId: string,
): Promise<{ added: number; removed: number }> {
  const room = await db.room.findUnique({
    where: {
      id: roomId,
      userId,
    },
  });

  if (!room || room.type !== "smart") {
    return { added: 0, removed: 0 };
  }

  const roomWithFilters: RoomWithFilters = {
    ...room,
    filters: room.filters as RoomFilters | null,
  };

  const items = await loadUserItemsWithDetails(userId);

  // Get current room items
  const currentRoomItems = await db.roomItem.findMany({
    where: { roomId },
    select: { itemId: true },
  });
  const currentItemIds = new Set(currentRoomItems.map((ri) => ri.itemId));

  const itemsToAdd: string[] = [];
  const itemsToRemove: string[] = [];

  for (const item of items) {
    const matches = itemMatchesRoom(item, roomWithFilters);
    const isInRoom = currentItemIds.has(item.id);

    if (matches && !isInRoom) {
      itemsToAdd.push(item.id);
    } else if (!matches && isInRoom) {
      itemsToRemove.push(item.id);
    }
  }

  // Batch add new items
  if (itemsToAdd.length > 0) {
    await db.roomItem.createMany({
      data: itemsToAdd.map((itemId) => ({
        roomId,
        itemId,
      })),
      skipDuplicates: true,
    });
  }

  // Batch remove items that no longer match
  if (itemsToRemove.length > 0) {
    await db.roomItem.deleteMany({
      where: {
        roomId,
        itemId: { in: itemsToRemove },
      },
    });
  }

  return {
    added: itemsToAdd.length,
    removed: itemsToRemove.length,
  };
}

/**
 * Get a room by ID with typed filters.
 */
export async function getRoomById(
  roomId: string,
  userId: string,
): Promise<RoomWithFilters | null> {
  const room = await db.room.findUnique({
    where: {
      id: roomId,
      userId,
    },
  });

  if (!room) return null;

  return {
    ...room,
    filters: room.filters as RoomFilters | null,
  };
}
