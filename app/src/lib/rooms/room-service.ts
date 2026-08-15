/**
 * Room service - handles room operations and item-room synchronization.
 */

import db from "@/lib/db";
import type { Filter } from "@/lib/search/types";
import { nameToSlug } from "@/lib/slug";
import { itemMatchesRoom } from "./room-matcher";
import type { ItemWithDetails, RoomWithFilters } from "./types";

/** Maximum number of smart rooms per user */
export const MAX_SMART_ROOMS_PER_USER = 5;

/**
 * Escape special regex characters in a string for safe use in RegExp constructor.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find the next available number suffix for a slug given existing similar slugs.
 * Returns 2 if no numbered slugs exist, otherwise returns max + 1.
 */
export function findNextSlugNumber(
  baseSlug: string,
  existingSlugs: (string | null)[],
): number {
  const escapedSlug = escapeRegex(baseSlug);
  const pattern = new RegExp(`^${escapedSlug}-(\\d+)$`, "i");

  const numbers = existingSlugs
    .map((slug) => {
      const match = slug?.match(pattern);
      return match ? Number.parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);

  return numbers.length > 0 ? Math.max(...numbers) + 1 : 2;
}

/**
 * Generate a unique slug from a room name for a given user.
 * Uses nameToSlug for conversion, then ensures uniqueness by appending a number if needed.
 */
export async function generateRoomSlug(
  name: string,
  userId: string,
): Promise<string> {
  const slug = nameToSlug(name);

  // Check if this slug already exists for this user
  const existing = await db.room.findFirst({
    where: {
      userId,
      slug: {
        equals: slug,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (!existing) {
    return slug;
  }

  // Find all slugs that start with this base slug for this user
  const similarSlugs = await db.room.findMany({
    where: {
      userId,
      slug: {
        startsWith: slug,
        mode: "insensitive",
      },
    },
    select: { slug: true },
  });

  // Find next available number using the extracted helper
  const nextNumber = findNextSlugNumber(
    slug,
    similarSlugs.map((r) => r.slug),
  );

  return `${slug}-${nextNumber}`;
}

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
    filters: room.filters as Filter[] | null,
  }));
}

/**
 * List a user's rooms (optionally filtered by type), newest first, each with its
 * item count. Shared by the rooms API and the MCP server.
 */
export async function listUserRooms(userId: string, type?: "smart" | "manual") {
  const rooms = await db.room.findMany({
    where: { userId, ...(type !== undefined && { type }) },
    select: {
      id: true,
      name: true,
      emoji: true,
      slug: true,
      type: true,
      filters: true,
      visibility: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { roomItems: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rooms.map(({ _count, ...room }) => ({
    ...room,
    itemCount: _count.roomItems,
  }));
}

export type RoomSummary = Awaited<ReturnType<typeof listUserRooms>>[number];

/**
 * Get smart rooms for a user that have a location filter.
 * Used to determine which rooms need re-syncing when an item's location changes.
 */
export async function getSmartRoomsWithLocationFilter(
  userId: string,
): Promise<RoomWithFilters[]> {
  const rooms = await getUserSmartRooms(userId);
  return rooms.filter((room) =>
    room.filters?.some((filter) => filter.type === "location"),
  );
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
 * Load all items for a user with details needed for room matching.
 */
export async function loadUserItemsWithDetails(
  userId: string,
): Promise<ItemWithDetails[]> {
  const items = await db.item.findMany({
    where: {
      userId,
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

  // Fetch existing memberships once instead of per-room (avoids N+1 on this hot write path)
  const existingRoomItems = await db.roomItem.findMany({
    where: { itemId: item.id },
    select: { roomId: true },
  });
  const existingRoomIds = new Set(existingRoomItems.map((ri) => ri.roomId));

  const roomIdsToAdd: string[] = [];
  const roomIdsToRemove: string[] = [];

  for (const room of rooms) {
    const matches = itemMatchesRoom(item, room);
    const isInRoom = existingRoomIds.has(room.id);

    if (matches && !isInRoom) {
      roomIdsToAdd.push(room.id);
    } else if (!matches && isInRoom) {
      roomIdsToRemove.push(room.id);
    }
  }

  // Batch add new memberships
  if (roomIdsToAdd.length > 0) {
    await db.roomItem.createMany({
      data: roomIdsToAdd.map((roomId) => ({
        roomId,
        itemId: item.id,
      })),
      skipDuplicates: true,
    });
  }

  // Batch remove memberships that no longer match
  if (roomIdsToRemove.length > 0) {
    await db.roomItem.deleteMany({
      where: {
        itemId: item.id,
        roomId: { in: roomIdsToRemove },
      },
    });
  }

  return { added: roomIdsToAdd.length, removed: roomIdsToRemove.length };
}

/**
 * Re-sync all items for a room based on its filters.
 * Used when room filters are updated.
 *
 * @returns Object with arrays of added/removed itemIds and their counts
 */
export async function syncRoomItems(
  roomId: string,
  userId: string,
): Promise<{
  addedItemIds: string[];
  removedItemIds: string[];
  added: number;
  removed: number;
}> {
  const room = await db.room.findUnique({
    where: {
      id: roomId,
      userId,
    },
  });

  if (!room || room.type !== "smart") {
    return { addedItemIds: [], removedItemIds: [], added: 0, removed: 0 };
  }

  const roomWithFilters: RoomWithFilters = {
    ...room,
    filters: room.filters as Filter[] | null,
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
    addedItemIds: itemsToAdd,
    removedItemIds: itemsToRemove,
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
    filters: room.filters as Filter[] | null,
  };
}
