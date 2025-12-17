/**
 * Query builder for search filters.
 *
 * Builds raw SQL fragments for various filter types that can be composed
 * into a complete WHERE clause.
 */

import {
  ItemKind,
  SourceType,
  type ItemKind as ItemKindType,
  type SourceType as SourceTypeType,
} from "@prisma/client";
import {
  getColorNames,
  getNearestColorName,
  normalizeColor,
} from "./color-utils";

export type FilterValue = { value: string; negated: boolean; orGroup?: number };

export type ParsedFilters = {
  type?: FilterValue[];
  tag?: FilterValue[];
  object?: FilterValue[];
  color?: FilterValue[];
  source?: FilterValue[];
  location?: FilterValue[];
  dateAfter?: string;
  dateBefore?: string;
  ocr?: string;
};

/** Valid ItemKind enum values derived from Prisma schema */
export const VALID_ITEM_KINDS = Object.values(ItemKind) as ItemKindType[];

/** Valid SourceType enum values derived from Prisma schema */
export const VALID_SOURCE_TYPES = Object.values(SourceType) as SourceTypeType[];

/** Represents an invalid filter value that was rejected during validation */
export type InvalidFilterValue = {
  filterType: string;
  value: string;
  reason: string;
};

/**
 * Generic filter validation function for enum-based filters.
 * Validates filter values against a list of valid values and returns
 * valid filters (normalized to lowercase) and invalid values with helpful messages.
 */
function validateEnumFilters(
  filters: FilterValue[],
  validValues: string[],
  filterType: string,
): { valid: FilterValue[]; invalid: InvalidFilterValue[] } {
  const valid: FilterValue[] = [];
  const invalid: InvalidFilterValue[] = [];

  for (const filter of filters) {
    const normalized = filter.value.toLowerCase();
    if (validValues.includes(normalized)) {
      valid.push({ ...filter, value: normalized });
    } else {
      invalid.push({
        filterType,
        value: filter.value,
        reason: `"${filter.value}" is not a valid ${filterType}. Valid ${filterType}s: ${validValues.join(", ")}`,
      });
    }
  }

  return { valid, invalid };
}

/**
 * Parse filter values from URL search params.
 * Handles negation (prefix with !), date operators (>, <), and OR groups (pipe |).
 *
 * Pipe-separated values (e.g., "image|article") are parsed as OR groups.
 * Multiple URL params for the same filter type are AND'd together.
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

  let orGroupCounter = 0;

  for (const filterType of arrayTypes) {
    const values = params.getAll(filterType);
    if (values.length > 0) {
      const filterValues: FilterValue[] = [];

      for (const v of values) {
        // Check if this value contains pipe-separated OR values
        if (v.includes("|")) {
          const orGroup = orGroupCounter++;
          const parts = v.split("|");
          for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed) {
              const negated = trimmed.startsWith("!");
              filterValues.push({
                value: negated ? trimmed.slice(1) : trimmed,
                negated,
                orGroup,
              });
            }
          }
        } else {
          const negated = v.startsWith("!");
          filterValues.push({
            value: negated ? v.slice(1) : v,
            negated,
          });
        }
      }

      if (filterValues.length > 0) {
        filters[filterType] = filterValues;
      }
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
 * Validate type filter values against the ItemKind enum.
 * Returns valid filters and any invalid values found.
 */
export function validateTypeFilters(filters: FilterValue[]): {
  valid: FilterValue[];
  invalid: InvalidFilterValue[];
} {
  return validateEnumFilters(filters, VALID_ITEM_KINDS, "type");
}

/**
 * Validate source filter values against the SourceType enum.
 * Returns valid filters and any invalid values found.
 */
export function validateSourceFilters(filters: FilterValue[]): {
  valid: FilterValue[];
  invalid: InvalidFilterValue[];
} {
  return validateEnumFilters(filters, VALID_SOURCE_TYPES, "source");
}

/**
 * Build SQL WHERE conditions for type filter.
 * Handles OR groups for pipe-separated values.
 * Validates values against ItemKind enum and returns invalid values.
 */
export function buildTypeCondition(filters: FilterValue[]): {
  sql: string;
  params: unknown[];
  invalid: InvalidFilterValue[];
} {
  // Validate type values
  const { valid: validFilters, invalid } = validateTypeFilters(filters);

  const sqlParams: unknown[] = [];
  let paramIndex = 1;

  // Group filters by orGroup
  const orGroups = new Map<number | undefined, FilterValue[]>();
  for (const filter of validFilters) {
    const key = filter.orGroup;
    const group = orGroups.get(key) || [];
    group.push(filter);
    orGroups.set(key, group);
  }

  // Build conditions for each group
  const groupConditions: string[] = [];

  for (const group of orGroups.values()) {
    const conditions: string[] = [];

    for (const filter of group) {
      if (filter.negated) {
        conditions.push(`(kind IS NULL OR kind != $${paramIndex}::"ItemKind")`);
      } else {
        conditions.push(`kind = $${paramIndex}::"ItemKind"`);
      }
      sqlParams.push(filter.value);
      paramIndex++;
    }

    if (conditions.length > 0) {
      // Within an OR group, use OR; standalone filters use the condition as-is
      if (group[0]?.orGroup !== undefined && conditions.length > 1) {
        groupConditions.push(`(${conditions.join(" OR ")})`);
      } else {
        groupConditions.push(...conditions);
      }
    }
  }

  return {
    sql: groupConditions.length > 0 ? `(${groupConditions.join(" AND ")})` : "",
    params: sqlParams,
    invalid,
  };
}

/**
 * Build SQL WHERE conditions for tag filter.
 * Case-insensitive matching using array unnest.
 * Handles OR groups for pipe-separated values.
 */
export function buildTagCondition(
  filters: FilterValue[],
  startParamIndex: number,
): { sql: string; params: unknown[] } {
  const sqlParams: unknown[] = [];
  let paramIndex = startParamIndex;

  // Group filters by orGroup
  const orGroups = new Map<number | undefined, FilterValue[]>();
  for (const filter of filters) {
    const key = filter.orGroup;
    const group = orGroups.get(key) || [];
    group.push(filter);
    orGroups.set(key, group);
  }

  // Build conditions for each group
  const groupConditions: string[] = [];

  for (const group of orGroups.values()) {
    const conditions: string[] = [];

    for (const filter of group) {
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

    if (conditions.length > 0) {
      if (group[0]?.orGroup !== undefined && conditions.length > 1) {
        groupConditions.push(`(${conditions.join(" OR ")})`);
      } else {
        groupConditions.push(...conditions);
      }
    }
  }

  return {
    sql: groupConditions.length > 0 ? `(${groupConditions.join(" AND ")})` : "",
    params: sqlParams,
  };
}

/**
 * Build SQL WHERE conditions for object filter.
 * Case-insensitive matching on item_image_details.objects.
 * Handles OR groups for pipe-separated values.
 */
export function buildObjectCondition(
  filters: FilterValue[],
  startParamIndex: number,
): { sql: string; params: unknown[] } {
  const sqlParams: unknown[] = [];
  let paramIndex = startParamIndex;

  // Group filters by orGroup
  const orGroups = new Map<number | undefined, FilterValue[]>();
  for (const filter of filters) {
    const key = filter.orGroup;
    const group = orGroups.get(key) || [];
    group.push(filter);
    orGroups.set(key, group);
  }

  // Build conditions for each group
  const groupConditions: string[] = [];

  for (const group of orGroups.values()) {
    const conditions: string[] = [];

    for (const filter of group) {
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

    if (conditions.length > 0) {
      if (group[0]?.orGroup !== undefined && conditions.length > 1) {
        groupConditions.push(`(${conditions.join(" OR ")})`);
      } else {
        groupConditions.push(...conditions);
      }
    }
  }

  return {
    sql: groupConditions.length > 0 ? `(${groupConditions.join(" AND ")})` : "",
    params: sqlParams,
  };
}

/**
 * Build SQL WHERE conditions for source filter.
 * Validates values against SourceType enum.
 * Handles OR groups for pipe-separated values.
 */
export function buildSourceCondition(
  filters: FilterValue[],
  startParamIndex: number,
): { sql: string; params: unknown[]; invalid: InvalidFilterValue[] } {
  // Validate source values
  const { valid: validFilters, invalid } = validateSourceFilters(filters);

  const sqlParams: unknown[] = [];
  let paramIndex = startParamIndex;

  // Group filters by orGroup
  const orGroups = new Map<number | undefined, FilterValue[]>();
  for (const filter of validFilters) {
    const key = filter.orGroup;
    const group = orGroups.get(key) || [];
    group.push(filter);
    orGroups.set(key, group);
  }

  // Build conditions for each group
  const groupConditions: string[] = [];

  for (const group of orGroups.values()) {
    const conditions: string[] = [];

    for (const filter of group) {
      if (filter.negated) {
        conditions.push(
          `(source_type IS NULL OR source_type != $${paramIndex}::"SourceType")`,
        );
      } else {
        conditions.push(`source_type = $${paramIndex}::"SourceType"`);
      }
      sqlParams.push(filter.value);
      paramIndex++;
    }

    if (conditions.length > 0) {
      if (group[0]?.orGroup !== undefined && conditions.length > 1) {
        groupConditions.push(`(${conditions.join(" OR ")})`);
      } else {
        groupConditions.push(...conditions);
      }
    }
  }

  return {
    sql: groupConditions.length > 0 ? `(${groupConditions.join(" AND ")})` : "",
    params: sqlParams,
    invalid,
  };
}

/**
 * Build SQL WHERE conditions for location filter.
 * Flat search across neighborhood, city, region, country.
 * Handles OR groups for pipe-separated values.
 */
export function buildLocationCondition(
  filters: FilterValue[],
  startParamIndex: number,
): { sql: string; params: unknown[] } {
  const sqlParams: unknown[] = [];
  let paramIndex = startParamIndex;

  // Group filters by orGroup
  const orGroups = new Map<number | undefined, FilterValue[]>();
  for (const filter of filters) {
    const key = filter.orGroup;
    const group = orGroups.get(key) || [];
    group.push(filter);
    orGroups.set(key, group);
  }

  // Build conditions for each group
  const groupConditions: string[] = [];

  for (const group of orGroups.values()) {
    const conditions: string[] = [];

    for (const filter of group) {
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

    if (conditions.length > 0) {
      if (group[0]?.orGroup !== undefined && conditions.length > 1) {
        groupConditions.push(`(${conditions.join(" OR ")})`);
      } else {
        groupConditions.push(...conditions);
      }
    }
  }

  return {
    sql: groupConditions.length > 0 ? `(${groupConditions.join(" AND ")})` : "",
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
 * Normalize a color filter value to its canonical color name.
 * Accepts both named colors ("red") and hex values ("#FF0000").
 * For hex values, finds the nearest named color.
 *
 * @param value - Color filter value (name or hex)
 * @returns Canonical color name, or null if invalid
 */
export function normalizeColorFilterValue(value: string): string | null {
  const trimmed = value.trim().toLowerCase();

  // Check if it's a named color
  const validNames = getColorNames();
  if (validNames.includes(trimmed) || trimmed === "grey") {
    // Normalize grey -> gray
    return trimmed === "grey" ? "gray" : trimmed;
  }

  // Check if it's a hex color - find nearest named color
  const normalized = normalizeColor(value);
  if (normalized) {
    return getNearestColorName(normalized);
  }

  return null;
}

/**
 * Build SQL WHERE conditions for color filter.
 * Filters by the `name` field in the JSONB colors array.
 * This is much more efficient than post-query filtering.
 * Handles OR groups for pipe-separated values.
 */
export function buildColorCondition(
  filters: FilterValue[],
  startParamIndex: number,
): { sql: string; params: unknown[] } {
  const sqlParams: unknown[] = [];
  let paramIndex = startParamIndex;

  // Group filters by orGroup
  const orGroups = new Map<number | undefined, FilterValue[]>();
  for (const filter of filters) {
    const key = filter.orGroup;
    const group = orGroups.get(key) || [];
    group.push(filter);
    orGroups.set(key, group);
  }

  // Build conditions for each group
  const groupConditions: string[] = [];

  for (const group of orGroups.values()) {
    const conditions: string[] = [];

    for (const filter of group) {
      const colorName = normalizeColorFilterValue(filter.value);
      if (!colorName) continue; // Skip invalid color values

      if (filter.negated) {
        // Item should NOT have this color
        conditions.push(
          `NOT EXISTS (
          SELECT 1 FROM item_image_details iid
          WHERE iid.item_id = items.id
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(iid.colors) c
            WHERE lower(c->>'name') = lower($${paramIndex})
          )
        )`,
        );
      } else {
        // Item should have this color
        conditions.push(
          `EXISTS (
          SELECT 1 FROM item_image_details iid
          WHERE iid.item_id = items.id
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(iid.colors) c
            WHERE lower(c->>'name') = lower($${paramIndex})
          )
        )`,
        );
      }
      sqlParams.push(colorName);
      paramIndex++;
    }

    if (conditions.length > 0) {
      if (group[0]?.orGroup !== undefined && conditions.length > 1) {
        groupConditions.push(`(${conditions.join(" OR ")})`);
      } else {
        groupConditions.push(...conditions);
      }
    }
  }

  return {
    sql: groupConditions.length > 0 ? `(${groupConditions.join(" AND ")})` : "",
    params: sqlParams,
  };
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
