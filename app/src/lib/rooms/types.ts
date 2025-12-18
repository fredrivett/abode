/**
 * Types for smart room filtering.
 *
 * Uses the same filter structure as the search system for consistency.
 */

import type {
  Item,
  ItemImageDetails,
  ItemLocation,
  Room,
  RoomVisibility,
} from "@prisma/client";

/**
 * Filter value with optional negation and OR grouping.
 * Matches the structure from search/query-builder.ts
 */
export type FilterValue = {
  value: string;
  negated: boolean;
  orGroup?: number;
};

/**
 * Room filters structure - same as ParsedFilters from search.
 * Stored as JSONB in the rooms.filters column.
 */
export type RoomFilters = {
  type?: FilterValue[];
  tag?: FilterValue[];
  object?: FilterValue[];
  color?: FilterValue[];
  source?: FilterValue[];
  location?: FilterValue[];
  dateAfter?: string;
  dateBefore?: string;
  // Note: ocr is not supported in smart rooms v1
};

/**
 * Item with all related data needed for room matching.
 */
export type ItemWithDetails = Item & {
  imageDetails: ItemImageDetails | null;
  locations: ItemLocation[];
};

/**
 * Room with typed filters.
 */
export type RoomWithFilters = Omit<Room, "filters"> & {
  filters: RoomFilters | null;
};

/**
 * Check if room visibility is public.
 */
export function isPublicRoom(visibility: RoomVisibility): boolean {
  return visibility === "public";
}
