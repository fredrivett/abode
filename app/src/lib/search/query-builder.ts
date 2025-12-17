/**
 * Query builder for search filters.
 *
 * Builds raw SQL fragments for various filter types that can be composed
 * into a complete WHERE clause.
 */

import { colorProximity, colorsMatch, normalizeColor } from "./color-utils";

export type ParsedFilters = {
  type?: { value: string; negated: boolean }[];
  tag?: { value: string; negated: boolean }[];
  object?: { value: string; negated: boolean }[];
  color?: { value: string; negated: boolean }[];
  source?: { value: string; negated: boolean }[];
  location?: { value: string; negated: boolean }[];
  dateAfter?: string;
  dateBefore?: string;
  ocr?: string;
};

/**
 * Parse filter values from URL search params.
 * Handles negation (prefix with !) and date operators (>, <).
 */
export function parseFiltersFromParams(params: URLSearchParams): ParsedFilters {
  const filters: ParsedFilters = {};

  // Parse array-type filters
  const arrayTypes = [
    "type",
    "tag",
    "object",
    "color",
    "source",
    "location",
  ] as const;
  for (const filterType of arrayTypes) {
    const values = params.getAll(filterType);
    if (values.length > 0) {
      filters[filterType] = values.map((v) => {
        const negated = v.startsWith("!");
        return {
          value: negated ? v.slice(1) : v,
          negated,
        };
      });
    }
  }

  // Parse date filters
  const dateValues = params.getAll("date");
  for (const dateValue of dateValues) {
    if (dateValue.startsWith(">")) {
      filters.dateAfter = dateValue.slice(1);
    } else if (dateValue.startsWith("<")) {
      filters.dateBefore = dateValue.slice(1);
    } else if (dateValue.includes("..")) {
      const [start, end] = dateValue.split("..");
      filters.dateAfter = start;
      filters.dateBefore = end;
    }
  }

  // Parse OCR filter
  const ocrValue = params.get("ocr");
  if (ocrValue) {
    filters.ocr = ocrValue;
  }

  return filters;
}

/**
 * Build SQL WHERE conditions for type filter.
 */
export function buildTypeCondition(
  filters: { value: string; negated: boolean }[],
): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const sqlParams: unknown[] = [];
  let paramIndex = 1;

  for (const filter of filters) {
    if (filter.negated) {
      conditions.push(`(kind IS NULL OR kind != $${paramIndex})`);
    } else {
      conditions.push(`kind = $${paramIndex}`);
    }
    sqlParams.push(filter.value);
    paramIndex++;
  }

  return {
    sql: conditions.length > 0 ? `(${conditions.join(" AND ")})` : "",
    params: sqlParams,
  };
}

/**
 * Build SQL WHERE conditions for tag filter.
 * Case-insensitive matching using array unnest.
 */
export function buildTagCondition(
  filters: { value: string; negated: boolean }[],
  startParamIndex: number,
): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const sqlParams: unknown[] = [];
  let paramIndex = startParamIndex;

  for (const filter of filters) {
    if (filter.negated) {
      conditions.push(
        `NOT EXISTS (SELECT 1 FROM unnest(tags) t WHERE lower(t) = lower($${paramIndex}))`,
      );
    } else {
      conditions.push(
        `EXISTS (SELECT 1 FROM unnest(tags) t WHERE lower(t) = lower($${paramIndex}))`,
      );
    }
    sqlParams.push(filter.value);
    paramIndex++;
  }

  return {
    sql: conditions.length > 0 ? `(${conditions.join(" AND ")})` : "",
    params: sqlParams,
  };
}

/**
 * Build SQL WHERE conditions for object filter.
 * Case-insensitive matching on item_image_details.objects.
 */
export function buildObjectCondition(
  filters: { value: string; negated: boolean }[],
  startParamIndex: number,
): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const sqlParams: unknown[] = [];
  let paramIndex = startParamIndex;

  for (const filter of filters) {
    if (filter.negated) {
      conditions.push(
        `NOT EXISTS (SELECT 1 FROM item_image_details iid WHERE iid.item_id = items.id AND EXISTS (SELECT 1 FROM unnest(iid.objects) o WHERE lower(o) = lower($${paramIndex})))`,
      );
    } else {
      conditions.push(
        `EXISTS (SELECT 1 FROM item_image_details iid WHERE iid.item_id = items.id AND EXISTS (SELECT 1 FROM unnest(iid.objects) o WHERE lower(o) = lower($${paramIndex})))`,
      );
    }
    sqlParams.push(filter.value);
    paramIndex++;
  }

  return {
    sql: conditions.length > 0 ? `(${conditions.join(" AND ")})` : "",
    params: sqlParams,
  };
}

/**
 * Build SQL WHERE conditions for source filter.
 * Case-insensitive matching.
 */
export function buildSourceCondition(
  filters: { value: string; negated: boolean }[],
  startParamIndex: number,
): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const sqlParams: unknown[] = [];
  let paramIndex = startParamIndex;

  for (const filter of filters) {
    if (filter.negated) {
      conditions.push(
        `(source_type IS NULL OR lower(source_type) != lower($${paramIndex}))`,
      );
    } else {
      conditions.push(`lower(source_type) = lower($${paramIndex})`);
    }
    sqlParams.push(filter.value);
    paramIndex++;
  }

  return {
    sql: conditions.length > 0 ? `(${conditions.join(" AND ")})` : "",
    params: sqlParams,
  };
}

/**
 * Build SQL WHERE conditions for location filter.
 * Flat search across neighborhood, city, region, country.
 */
export function buildLocationCondition(
  filters: { value: string; negated: boolean }[],
  startParamIndex: number,
): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const sqlParams: unknown[] = [];
  let paramIndex = startParamIndex;

  for (const filter of filters) {
    const locationMatch = `EXISTS (
      SELECT 1 FROM item_locations il
      WHERE il.item_id = items.id
      AND (
        lower(il.neighborhood) = lower($${paramIndex})
        OR lower(il.city) = lower($${paramIndex})
        OR lower(il.region) = lower($${paramIndex})
        OR lower(il.country) = lower($${paramIndex})
      )
    )`;

    if (filter.negated) {
      conditions.push(`NOT ${locationMatch}`);
    } else {
      conditions.push(locationMatch);
    }
    sqlParams.push(filter.value);
    paramIndex++;
  }

  return {
    sql: conditions.length > 0 ? `(${conditions.join(" AND ")})` : "",
    params: sqlParams,
  };
}

/**
 * Build SQL WHERE conditions for date filter.
 * Uses capture_date with fallback to created_at.
 */
export function buildDateCondition(
  dateAfter?: string,
  dateBefore?: string,
  startParamIndex = 1,
): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const sqlParams: unknown[] = [];
  let paramIndex = startParamIndex;

  // Use capture_date if available, fallback to created_at
  const dateExpr = `COALESCE(
    (SELECT iid.capture_date FROM item_image_details iid WHERE iid.item_id = items.id),
    items.created_at
  )`;

  if (dateAfter) {
    conditions.push(`${dateExpr} >= $${paramIndex}::timestamp`);
    sqlParams.push(dateAfter);
    paramIndex++;
  }

  if (dateBefore) {
    conditions.push(`${dateExpr} <= $${paramIndex}::timestamp`);
    sqlParams.push(dateBefore);
    paramIndex++;
  }

  return {
    sql: conditions.length > 0 ? `(${conditions.join(" AND ")})` : "",
    params: sqlParams,
  };
}

/**
 * Color filter is handled post-query since we need to calculate deltaE.
 * Returns item IDs that match the color filter.
 */
export type ColorMatch = {
  itemId: string;
  hex: string;
  proximity: number;
};

export function filterByColor(
  items: Array<{
    id: string;
    colors: Array<{ hex: string; percentage: number }> | null;
  }>,
  colorFilters: { value: string; negated: boolean }[],
  threshold = 5.0,
): {
  filteredIds: Set<string>;
  matches: Map<string, ColorMatch>;
} {
  const filteredIds = new Set<string>();
  const matches = new Map<string, ColorMatch>();

  // Helper to check if item has a matching color
  const findMatchingColor = (
    itemColors: Array<{ hex: string; percentage: number }>,
    filterHex: string,
  ): { hex: string; proximity: number } | null => {
    for (const itemColor of itemColors) {
      if (colorsMatch(filterHex, itemColor.hex, threshold)) {
        const proximity = colorProximity(filterHex, itemColor.hex);
        if (proximity !== null) {
          return { hex: itemColor.hex, proximity };
        }
      }
    }
    return null;
  };

  itemLoop: for (const item of items) {
    if (!item.colors || item.colors.length === 0) {
      // Items without colors don't match positive color filters
      // but do match negated color filters
      const allNegated = colorFilters.every((f) => f.negated);
      if (allNegated) {
        filteredIds.add(item.id);
      }
      continue;
    }

    let bestMatch: ColorMatch | null = null;

    for (const filter of colorFilters) {
      const normalizedFilter = normalizeColor(filter.value);
      if (!normalizedFilter) continue;

      const colorMatch = findMatchingColor(item.colors, normalizedFilter);
      const hasMatch = colorMatch !== null;

      if (filter.negated && hasMatch) {
        // Negated filter: item should NOT have this color, but it does
        continue itemLoop;
      }

      if (!filter.negated && !hasMatch) {
        // Positive filter: item should have this color, but doesn't
        continue itemLoop;
      }

      // Track best color match for reasons
      if (
        colorMatch &&
        (!bestMatch || colorMatch.proximity > bestMatch.proximity)
      ) {
        bestMatch = {
          itemId: item.id,
          hex: colorMatch.hex,
          proximity: colorMatch.proximity,
        };
      }
    }

    // Item passed all filters
    filteredIds.add(item.id);
    if (bestMatch) {
      matches.set(item.id, bestMatch);
    }
  }

  return { filteredIds, matches };
}

/**
 * Check if any filters are present.
 */
export function hasFilters(filters: ParsedFilters): boolean {
  return (
    (filters.type && filters.type.length > 0) ||
    (filters.tag && filters.tag.length > 0) ||
    (filters.object && filters.object.length > 0) ||
    (filters.color && filters.color.length > 0) ||
    (filters.source && filters.source.length > 0) ||
    (filters.location && filters.location.length > 0) ||
    filters.dateAfter !== undefined ||
    filters.dateBefore !== undefined ||
    filters.ocr !== undefined
  );
}

/**
 * Remap parameter indices in SQL string from 1-based to new start index.
 *
 * Used when composing SQL fragments that use $1, $2, etc. into a larger query
 * where those parameters need to be renumbered.
 *
 * @param sql - SQL string containing parameter placeholders ($1, $2, etc.)
 * @param paramCount - Number of parameters in the SQL string
 * @param newStartIndex - New starting index for parameters
 * @returns SQL string with remapped parameter indices
 */
export function remapParamIndices(
  sql: string,
  paramCount: number,
  newStartIndex: number,
): string {
  let result = sql;
  // Replace in reverse order to avoid double-replacing (e.g., $1 -> $10 -> $100)
  for (let i = paramCount; i >= 1; i--) {
    result = result.replace(
      new RegExp(`\\$${i}`, "g"),
      `$${newStartIndex + i - 1}`,
    );
  }
  return result;
}
