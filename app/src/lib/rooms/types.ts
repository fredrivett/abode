/**
 * Types for smart room filtering.
 *
 * Uses the same Filter[] structure as the search system for consistency.
 * Filters are stored directly as Filter[] in the rooms.filters JSONB column.
 */

import type {
  Item,
  ItemImageDetails,
  ItemLocation,
  Room,
  RoomVisibility,
} from "@prisma/client";
import type { Filter } from "@/lib/search/types";

/**
 * Item with all related data needed for room matching.
 */
export type ItemWithDetails = Item & {
  imageDetails: ItemImageDetails | null;
  locations: ItemLocation[];
};

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
