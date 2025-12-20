/**
 * Room matcher - evaluates if an item matches a room's filters.
 *
 * Performs in-memory matching against a loaded item with all its details.
 * Uses the same filter logic as the search system but without SQL.
 */

import { ItemKind, SourceType } from "@prisma/client";
import { normalizeColorFilterValue } from "../search/query-builder";
import type { Filter } from "../search/types";
import type { ItemWithDetails, RoomWithFilters } from "./types";

/**
 * Check if item kind matches filter value.
 */
function matchesType(item: ItemWithDetails, value: string): boolean {
  if (!item.kind) return false;
  return item.kind.toLowerCase() === value.toLowerCase();
}

/**
 * Check if item has a matching tag (case-insensitive).
 */
function matchesTag(item: ItemWithDetails, value: string): boolean {
  return item.tags.some((tag) => tag.toLowerCase() === value.toLowerCase());
}

/**
 * Check if item has a matching detected object (case-insensitive).
 */
function matchesObject(item: ItemWithDetails, value: string): boolean {
  if (!item.imageDetails?.objects) return false;
  return item.imageDetails.objects.some(
    (obj) => obj.toLowerCase() === value.toLowerCase(),
  );
}

/**
 * Check if item source type matches filter value.
 */
function matchesSource(item: ItemWithDetails, value: string): boolean {
  if (!item.sourceType) return false;
  return item.sourceType.toLowerCase() === value.toLowerCase();
}

/**
 * Check if item has a matching location (searches neighborhood, city, region, country).
 */
function matchesLocation(item: ItemWithDetails, value: string): boolean {
  const lowerValue = value.toLowerCase();
  return item.locations.some(
    (loc) =>
      loc.neighborhood?.toLowerCase() === lowerValue ||
      loc.city?.toLowerCase() === lowerValue ||
      loc.region?.toLowerCase() === lowerValue ||
      loc.country?.toLowerCase() === lowerValue,
  );
}

/**
 * Check if item has a matching color in its palette.
 * Normalizes color values (handles hex codes and color names).
 */
function matchesColor(item: ItemWithDetails, value: string): boolean {
  if (!item.imageDetails?.colors) return false;

  const normalizedFilterColor = normalizeColorFilterValue(value);
  if (!normalizedFilterColor) return false;

  const colors = item.imageDetails.colors as Array<{ name?: string }>;
  return colors.some(
    (color) =>
      color.name?.toLowerCase() === normalizedFilterColor.toLowerCase(),
  );
}

/**
 * Get the effective date for date filtering.
 * Uses capture date if available, otherwise falls back to created at.
 */
function getEffectiveDate(item: ItemWithDetails): Date {
  // Check for capture date in image details (from EXIF data)
  if (item.imageDetails?.captureDate) {
    return new Date(item.imageDetails.captureDate);
  }
  return new Date(item.createdAt);
}

/**
 * Check if item matches a date filter.
 */
function matchesDateFilter(item: ItemWithDetails, filter: Filter): boolean {
  const itemDate = getEffectiveDate(item);
  const filterDate = new Date(filter.value);
  if (Number.isNaN(filterDate.getTime())) return true; // Invalid date = pass

  switch (filter.dateOperator) {
    case "after":
      return itemDate >= filterDate;
    case "before":
      return itemDate <= filterDate;
    case "between": {
      if (!filter.endDate) return true;
      const endDate = new Date(filter.endDate);
      if (Number.isNaN(endDate.getTime())) return true;
      return itemDate >= filterDate && itemDate <= endDate;
    }
    default:
      // Same day comparison
      return (
        itemDate.toISOString().slice(0, 10) ===
        filterDate.toISOString().slice(0, 10)
      );
  }
}

const VALID_ITEM_KINDS = Object.values(ItemKind).map((k) => k.toLowerCase());
const VALID_SOURCE_TYPES = Object.values(SourceType).map((s) =>
  s.toLowerCase(),
);

/**
 * Check if a single filter matches the item.
 */
function filterMatchesItem(item: ItemWithDetails, filter: Filter): boolean {
  let matches: boolean;

  switch (filter.type) {
    case "type":
      // Validate against enum
      if (!VALID_ITEM_KINDS.includes(filter.value.toLowerCase())) {
        return true; // Invalid type filter = pass (don't block)
      }
      matches = matchesType(item, filter.value);
      break;
    case "tag":
      matches = matchesTag(item, filter.value);
      break;
    case "object":
      matches = matchesObject(item, filter.value);
      break;
    case "color":
      matches = matchesColor(item, filter.value);
      break;
    case "source":
      // Validate against enum
      if (!VALID_SOURCE_TYPES.includes(filter.value.toLowerCase())) {
        return true; // Invalid source filter = pass (don't block)
      }
      matches = matchesSource(item, filter.value);
      break;
    case "location":
      matches = matchesLocation(item, filter.value);
      break;
    case "date":
      matches = matchesDateFilter(item, filter);
      break;
    default:
      // Unknown filter type = pass
      return true;
  }

  // Apply negation
  return filter.negated ? !matches : matches;
}

/**
 * Check if an item matches a room's filters.
 *
 * All filters are AND'd together - item must match all filters.
 *
 * @param item - Item with all related data (imageDetails, locations)
 * @param room - Room with typed filters
 * @returns true if item matches all room filters
 */
export function itemMatchesRoom(
  item: ItemWithDetails,
  room: RoomWithFilters,
): boolean {
  // Soft-deleted items never match
  if (item.deletedAt !== null) {
    return false;
  }

  // Check exclude flag for public rooms
  if (room.visibility === "public" && item.excludeFromPublicRooms) {
    return false;
  }

  const filters = room.filters;

  // No filters = no items match (smart room must have at least one filter)
  if (!filters || filters.length === 0) {
    return false;
  }

  // All filters must match (AND logic)
  return filters.every((filter) => filterMatchesItem(item, filter));
}
