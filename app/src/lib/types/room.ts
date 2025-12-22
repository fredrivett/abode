/**
 * Shared room types used across the application.
 *
 * These are client-side types derived from Prisma models but with
 * serialized dates (strings) and typed JSON fields for use in components.
 */

import type {
  Room as PrismaRoom,
  RoomItem as PrismaRoomItem,
} from "@prisma/client";
import type { Filter } from "@/lib/search/types";
import type { Item } from "./item";

/**
 * Room data for client components.
 *
 * Derived from Prisma Room but with:
 * - Dates serialized as ISO strings
 * - Filters typed as Filter[] instead of Json
 * - itemCount added (computed from _count)
 */
export type Room = Pick<PrismaRoom, "id" | "name" | "type" | "visibility"> & {
  filters: Filter[] | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
};

/**
 * Room with slug for list views.
 *
 * Extends Room with slug field needed for URL generation.
 */
export type RoomWithSlug = Room & {
  slug: string;
};

/**
 * Item within a room, with room-specific metadata.
 *
 * Combines the Item type with RoomItem fields (renamed for clarity).
 */
export type RoomItem = Item & {
  /** The RoomItem.id (junction table ID) */
  roomItemId: PrismaRoomItem["id"];
  /** When the item was added to the room (serialized as ISO string) */
  addedAt: string;
};
