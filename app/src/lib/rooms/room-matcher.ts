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
 * Get the effective location for an item.
 * Uses manual override if exists, otherwise falls back to exif location.
 */
function getEffectiveLocation(
  item: ItemWithDetails,
): ItemWithDetails["locations"][0] | null {
  const manualLocation = item.locations.find((l) => l.source === "manual");
  const exifLocation = item.locations.find((l) => l.source === "exif");
  return manualLocation ?? exifLocation ?? null;
}

/**
 * Check if item has a matching location (searches neighborhood, city, region, country).
 * Uses the effective location (manual override takes priority over exif).
 */
function matchesLocation(item: ItemWithDetails, value: string): boolean {
  const location = getEffectiveLocation(item);
  if (!location) return false;

  const lowerValue = value.toLowerCase();
  return (
    location.neighborhood?.toLowerCase() === lowerValue ||
    location.city?.toLowerCase() === lowerValue ||
    location.region?.toLowerCase() === lowerValue ||
    location.country?.toLowerCase() === lowerValue
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
 *
 * Date comparisons use ISO date strings (YYYY-MM-DD) for the default "is"
 * operator to ensure timezone-agnostic day matching. The filter.value is
 * expected to be in ISO format (e.g., "2024-01-15"). Both dates are converted
 * to ISO strings and compared by their date portion only.
 *
 * For "after" and "before" operators, full datetime comparison is used,
 * which means the comparison happens in the local timezone of the server.
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
      // Same day comparison using ISO date string (YYYY-MM-DD)
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
 * Check if item matches a single value for a given filter type.
 * Does not handle negation - that's applied at the filter level.
 */
function matchesSingleValue(
  item: ItemWithDetails,
  type: Filter["type"],
  value: string,
): boolean {
  switch (type) {
    case "type":
      // Validate against enum
      if (!VALID_ITEM_KINDS.includes(value.toLowerCase())) {
        return true; // Invalid type filter = pass (don't block)
      }
      return matchesType(item, value);
    case "tag":
      return matchesTag(item, value);
    case "object":
      return matchesObject(item, value);
    case "color":
      return matchesColor(item, value);
    case "source":
      // Validate against enum
      if (!VALID_SOURCE_TYPES.includes(value.toLowerCase())) {
        return true; // Invalid source filter = pass (don't block)
      }
      return matchesSource(item, value);
    case "location":
      return matchesLocation(item, value);
    default:
      return true;
  }
}

/**
 * Check if a single filter matches the item.
 *
 * Supports OR groups via pipe syntax (e.g., "image|article").
 * For pipe-separated values, returns true if ANY value matches.
 */
function filterMatchesItem(item: ItemWithDetails, filter: Filter): boolean {
  let matches: boolean;

  // Date filters don't support pipe syntax
  if (filter.type === "date") {
    matches = matchesDateFilter(item, filter);
  } else if (filter.value.includes("|")) {
    // OR group: split by pipe and check if ANY value matches
    const values = filter.value.split("|").map((v) => v.trim());
    matches = values.some((value) =>
      matchesSingleValue(item, filter.type, value),
    );
  } else {
    matches = matchesSingleValue(item, filter.type, filter.value);
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
