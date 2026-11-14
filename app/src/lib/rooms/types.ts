/**
 * Types for smart room filtering.
 *
 * Uses the same Filter[] structure as the search system for consistency.
 * Filters are stored directly as Filter[] in the rooms.filters JSONB column.
 */

import type { Prisma, Room, RoomVisibility } from "@prisma/client";
import type { Filter } from "@/lib/search/types";

/**
 * The item fields the room matcher reads, and nothing else: syncing a room
 * loads the user's whole library, so full rows (article bodies, OCR text,
 * vision JSON, blur data URLs) would all land in memory. The matcher is typed
 * against this select's payload, so reading a field it doesn't list fails tsc.
 */
export const roomMatchItemSelect = {
  id: true,
  kind: true,
  sourceType: true,
  tags: true,
  userTags: true,
  createdAt: true,
  excludeFromPublicRooms: true,
  imageDetails: { select: { objects: true, colors: true, captureDate: true } },
  bookDetails: { select: { status: true } },
  articleDetails: { select: { readAt: true } },
  locations: {
    select: {
      source: true,
      neighborhood: true,
      city: true,
      region: true,
      country: true,
    },
  },
} satisfies Prisma.ItemSelect;

/**
 * Item with the data needed for room matching.
 */
export type RoomMatchItem = Prisma.ItemGetPayload<{
  select: typeof roomMatchItemSelect;
}>;

/**
 * Room with typed filters (Filter[] stored as JSONB).
 */
export type RoomWithFilters = Omit<Room, "filters"> & {
  filters: Filter[] | null;
};

/**
 * Check if room visibility is public.
 */
export function isPublicRoom(visibility: RoomVisibility): boolean {
  return visibility === "public";
}

/**
 * Check if a filters array has at least one valid filter.
 * Used for validation before saving smart rooms.
 */
export function hasValidFilters(filters: Filter[] | null): boolean {
  return filters !== null && filters.length > 0;
}
