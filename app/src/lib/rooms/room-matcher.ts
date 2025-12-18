/**
 * Room matcher - evaluates if an item matches a room's filters.
 *
 * Performs in-memory matching against a loaded item with all its details.
 * Uses the same filter logic as the search system but without SQL.
 */

import { ItemKind, SourceType } from "@prisma/client";
import { normalizeColorFilterValue } from "../search/query-builder";
import type {
  FilterValue,
  ItemWithDetails,
  RoomFilters,
  RoomWithFilters,
} from "./types";

/**
 * Group filters by their orGroup property.
 * Filters with the same orGroup are OR'd together.
 * Filters without an orGroup are each evaluated independently (AND'd).
 */
function groupFiltersByOrGroup(
  filters: FilterValue[],
): Map<number | undefined, FilterValue[]> {
  const groups = new Map<number | undefined, FilterValue[]>();
  for (const filter of filters) {
    const key = filter.orGroup;
    const group = groups.get(key) || [];
    group.push(filter);
    groups.set(key, group);
  }
  return groups;
}

/**
 * Evaluate grouped filters with custom matcher function.
 *
 * Within an OR group: ANY match = group passes
 * Across groups: ALL groups must pass (AND)
 *
 * Handles negation: negated filters must NOT match.
 */
function evaluateGroupedFilters(
  filters: FilterValue[],
  matchFn: (value: string) => boolean,
): boolean {
  const groups = groupFiltersByOrGroup(filters);

  for (const group of groups.values()) {
    const isOrGroup = group[0]?.orGroup !== undefined && group.length > 1;

    if (isOrGroup) {
      // OR group: at least one must match (respecting negation)
      const anyMatch = group.some((filter) => {
        const matches = matchFn(filter.value);
        return filter.negated ? !matches : matches;
      });
      if (!anyMatch) return false;
    } else {
      // Individual filters (AND): all must match (respecting negation)
      for (const filter of group) {
        const matches = matchFn(filter.value);
        const passed = filter.negated ? !matches : matches;
        if (!passed) return false;
      }
    }
  }

  return true;
}

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
 * Check if item's effective date is after the given date.
 */
function matchesDateAfter(item: ItemWithDetails, dateStr: string): boolean {
  const filterDate = new Date(dateStr);
  if (Number.isNaN(filterDate.getTime())) return true; // Invalid date = no filter
  return getEffectiveDate(item) >= filterDate;
}

/**
 * Check if item's effective date is before the given date.
 */
function matchesDateBefore(item: ItemWithDetails, dateStr: string): boolean {
  const filterDate = new Date(dateStr);
  if (Number.isNaN(filterDate.getTime())) return true; // Invalid date = no filter
  return getEffectiveDate(item) <= filterDate;
}

/**
 * Validate filter values against valid enum values.
 * Returns only valid filter values.
 */
function validateEnumFilters(
  filters: FilterValue[],
  validValues: string[],
): FilterValue[] {
  return filters.filter((f) => validValues.includes(f.value.toLowerCase()));
}

const VALID_ITEM_KINDS = Object.values(ItemKind).map((k) => k.toLowerCase());
const VALID_SOURCE_TYPES = Object.values(SourceType).map((s) =>
  s.toLowerCase(),
);

/**
 * Check if an item matches a room's filters.
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
  if (!filters) {
    return false;
  }

  // Check type filter
  if (filters.type && filters.type.length > 0) {
    const validFilters = validateEnumFilters(filters.type, VALID_ITEM_KINDS);
    if (validFilters.length > 0) {
      if (!evaluateGroupedFilters(validFilters, (v) => matchesType(item, v))) {
        return false;
      }
    }
  }

  // Check tag filter
  if (filters.tag && filters.tag.length > 0) {
    if (!evaluateGroupedFilters(filters.tag, (v) => matchesTag(item, v))) {
      return false;
    }
  }

  // Check object filter
  if (filters.object && filters.object.length > 0) {
    if (
      !evaluateGroupedFilters(filters.object, (v) => matchesObject(item, v))
    ) {
      return false;
    }
  }

  // Check color filter
  if (filters.color && filters.color.length > 0) {
    if (!evaluateGroupedFilters(filters.color, (v) => matchesColor(item, v))) {
      return false;
    }
  }

  // Check source filter
  if (filters.source && filters.source.length > 0) {
    const validFilters = validateEnumFilters(
      filters.source,
      VALID_SOURCE_TYPES,
    );
    if (validFilters.length > 0) {
      if (
        !evaluateGroupedFilters(validFilters, (v) => matchesSource(item, v))
      ) {
        return false;
      }
    }
  }

  // Check location filter
  if (filters.location && filters.location.length > 0) {
    if (
      !evaluateGroupedFilters(filters.location, (v) => matchesLocation(item, v))
    ) {
      return false;
    }
  }

  // Check date filters
  if (filters.dateAfter && !matchesDateAfter(item, filters.dateAfter)) {
    return false;
  }

  if (filters.dateBefore && !matchesDateBefore(item, filters.dateBefore)) {
    return false;
  }

  return true;
}

/**
 * Check if a room has any valid filters defined.
 */
export function hasValidFilters(filters: RoomFilters | null): boolean {
  if (!filters) return false;

  return (
    (filters.type && filters.type.length > 0) ||
    (filters.tag && filters.tag.length > 0) ||
    (filters.object && filters.object.length > 0) ||
    (filters.color && filters.color.length > 0) ||
    (filters.source && filters.source.length > 0) ||
    (filters.location && filters.location.length > 0) ||
    filters.dateAfter !== undefined ||
    filters.dateBefore !== undefined
  );
}
