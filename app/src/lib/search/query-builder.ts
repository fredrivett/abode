/**
 * Query builder for search filters.
 *
 * Builds raw SQL fragments for various filter types that can be composed
 * into a complete WHERE clause.
 */

import {
  ItemKind,
  type ItemKind as ItemKindType,
  SourceType,
  type SourceType as SourceTypeType,
} from "@prisma/client";
import {
  getColorNames,
  getNearestColorName,
  hexToLab,
  normalizeColor,
} from "./color-utils";
import { NONE_FILTER_VALUE, NOT_NONE_FILTER_VALUE } from "./types";

/**
 * Check if a filter value is a special null filter ((none) or !(none)).
 * Returns whether we want "empty/null" values after considering negation.
 */
function checkNullFilter(
  filter: FilterValue,
): { isNull: true; wantEmpty: boolean } | { isNull: false } {
  if (
    filter.value === NONE_FILTER_VALUE ||
    filter.value === NOT_NONE_FILTER_VALUE
  ) {
    const isNone = filter.value === NONE_FILTER_VALUE;
    // XOR: (none) + negated = want non-empty, !(none) + negated = want empty
    const wantEmpty = isNone !== filter.negated;
    return { isNull: true, wantEmpty };
  }
  return { isNull: false };
}

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
 * Group filters by their orGroup property.
 * Filters with the same orGroup are grouped together for OR semantics.
 * Filters without an orGroup are each in their own group (undefined key).
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
 * Context passed to condition builders, allowing them to track params.
 */
type ConditionBuilderContext = {
  paramIndex: number;
  params: unknown[];
};

/**
 * Build SQL conditions from grouped filters with parameter tracking.
 * Takes a callback that generates SQL for each filter, handles OR/AND grouping,
 * and tracks SQL parameters.
 *
 * @param filters - Array of filter values
 * @param startParamIndex - Starting parameter index for SQL placeholders
 * @param buildCondition - Callback that returns SQL condition and optionally adds to params
 * @returns Object with combined SQL string and collected params
 */
function buildGroupedConditions(
  filters: FilterValue[],
  startParamIndex: number,
  buildCondition: (
    filter: FilterValue,
    ctx: ConditionBuilderContext,
  ) => string | null,
): { sql: string; params: unknown[] } {
  const orGroups = groupFiltersByOrGroup(filters);
  const groupConditions: string[] = [];
  const ctx: ConditionBuilderContext = {
    paramIndex: startParamIndex,
    params: [],
  };

  for (const group of orGroups.values()) {
    const conditions: string[] = [];

    for (const filter of group) {
      const condition = buildCondition(filter, ctx);
      if (condition) {
        conditions.push(condition);
      }
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
    params: ctx.params,
  };
}

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
  const { valid: validFilters, invalid } = validateTypeFilters(filters);

  const { sql, params } = buildGroupedConditions(
    validFilters,
    1,
    (filter, ctx) => {
      const condition = filter.negated
        ? `(kind IS NULL OR kind != $${ctx.paramIndex}::"ItemKind")`
        : `kind = $${ctx.paramIndex}::"ItemKind"`;
      ctx.params.push(filter.value);
      ctx.paramIndex++;
      return condition;
    },
  );

  return { sql, params, invalid };
}

/**
 * Build SQL WHERE conditions for tag filter.
 * Case-insensitive matching using array unnest.
 * Searches both auto-generated tags and user-added tags.
 * Handles OR groups for pipe-separated values.
 */
export function buildTagCondition(
  filters: FilterValue[],
  startParamIndex: number,
): { sql: string; params: unknown[] } {
  return buildGroupedConditions(filters, startParamIndex, (filter, ctx) => {
    // Handle (none)/!(none) special values
    const nullCheck = checkNullFilter(filter);
    if (nullCheck.isNull) {
      return nullCheck.wantEmpty
        ? `((tags IS NULL OR tags = '{}') AND (user_tags IS NULL OR user_tags = '{}'))`
        : `((tags IS NOT NULL AND tags != '{}') OR (user_tags IS NOT NULL AND user_tags != '{}'))`;
    }

    const condition = filter.negated
      ? `NOT (EXISTS (SELECT 1 FROM unnest(tags) t WHERE lower(t) = lower($${ctx.paramIndex})) OR EXISTS (SELECT 1 FROM unnest(user_tags) t WHERE lower(t) = lower($${ctx.paramIndex})))`
      : `(EXISTS (SELECT 1 FROM unnest(tags) t WHERE lower(t) = lower($${ctx.paramIndex})) OR EXISTS (SELECT 1 FROM unnest(user_tags) t WHERE lower(t) = lower($${ctx.paramIndex})))`;
    ctx.params.push(filter.value);
    ctx.paramIndex++;
    return condition;
  });
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
  return buildGroupedConditions(filters, startParamIndex, (filter, ctx) => {
    // Handle (none)/!(none) special values
    const nullCheck = checkNullFilter(filter);
    if (nullCheck.isNull) {
      return nullCheck.wantEmpty
        ? `NOT EXISTS (SELECT 1 FROM item_image_details iid WHERE iid.item_id = items.id AND iid.objects IS NOT NULL AND array_length(iid.objects, 1) > 0)`
        : `EXISTS (SELECT 1 FROM item_image_details iid WHERE iid.item_id = items.id AND iid.objects IS NOT NULL AND array_length(iid.objects, 1) > 0)`;
    }

    const condition = filter.negated
      ? `NOT EXISTS (SELECT 1 FROM item_image_details iid WHERE iid.item_id = items.id AND EXISTS (SELECT 1 FROM unnest(iid.objects) o WHERE lower(o) = lower($${ctx.paramIndex})))`
      : `EXISTS (SELECT 1 FROM item_image_details iid WHERE iid.item_id = items.id AND EXISTS (SELECT 1 FROM unnest(iid.objects) o WHERE lower(o) = lower($${ctx.paramIndex})))`;
    ctx.params.push(filter.value);
    ctx.paramIndex++;
    return condition;
  });
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
  // Separate null filters from regular filters (null filters don't need validation)
  const nullFilters: FilterValue[] = [];
  const regularFilters: FilterValue[] = [];
  for (const filter of filters) {
    const nullCheck = checkNullFilter(filter);
    if (nullCheck.isNull) {
      nullFilters.push(filter);
    } else {
      regularFilters.push(filter);
    }
  }

  const { valid: validFilters, invalid } =
    validateSourceFilters(regularFilters);

  // Combine null filters with validated regular filters
  const allFilters = [...nullFilters, ...validFilters];

  const { sql, params } = buildGroupedConditions(
    allFilters,
    startParamIndex,
    (filter, ctx) => {
      // Handle (none)/!(none) special values
      const nullCheck = checkNullFilter(filter);
      if (nullCheck.isNull) {
        return nullCheck.wantEmpty
          ? `source_type IS NULL`
          : `source_type IS NOT NULL`;
      }

      const condition = filter.negated
        ? `(source_type IS NULL OR source_type != $${ctx.paramIndex}::"SourceType")`
        : `source_type = $${ctx.paramIndex}::"SourceType"`;
      ctx.params.push(filter.value);
      ctx.paramIndex++;
      return condition;
    },
  );

  return { sql, params, invalid };
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
  return buildGroupedConditions(filters, startParamIndex, (filter, ctx) => {
    // Handle (none)/!(none) special values
    const nullCheck = checkNullFilter(filter);
    if (nullCheck.isNull) {
      return nullCheck.wantEmpty
        ? `NOT EXISTS (SELECT 1 FROM item_locations il WHERE il.item_id = items.id)`
        : `EXISTS (SELECT 1 FROM item_locations il WHERE il.item_id = items.id)`;
    }

    const locationMatch = `EXISTS (
      SELECT 1 FROM item_locations il
      WHERE il.item_id = items.id
      AND (
        lower(il.neighborhood) = lower($${ctx.paramIndex})
        OR lower(il.city) = lower($${ctx.paramIndex})
        OR lower(il.region) = lower($${ctx.paramIndex})
        OR lower(il.country) = lower($${ctx.paramIndex})
      )
    )`;
    const condition = filter.negated ? `NOT ${locationMatch}` : locationMatch;
    ctx.params.push(filter.value);
    ctx.paramIndex++;
    return condition;
  });
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

// Fixed threshold for "similar" colours in deltaE units
// deltaE 0-5 = nearly identical, 5-15 = very similar, 15-25 = similar, 25+ = different
const COLOR_DELTA_E_THRESHOLD = 25;

/**
 * Generate deltaE_lab SQL call fragment.
 * Compares target LAB values (from params) against stored LAB values in JSONB.
 *
 * @param paramIndex - Starting parameter index for target L, a, b values
 * @returns SQL fragment for deltaE_lab function call
 */
function deltaELabSql(paramIndex: number): string {
  return `delta_e_lab(
    $${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2},
    (c->>'l')::float, (c->>'a')::float, (c->>'b')::float
  )`;
}

/**
 * Build SQL WHERE conditions for color filter.
 *
 * For named colors (e.g., "red"): filters by the `name` field in the JSONB colors array.
 * For hex colors (e.g., "#FF5733"): uses deltaE_lab for perceptual color matching.
 *
 * Handles OR groups for pipe-separated values.
 */
export function buildColorCondition(
  filters: FilterValue[],
  startParamIndex: number,
): { sql: string; params: unknown[] } {
  return buildGroupedConditions(filters, startParamIndex, (filter, ctx) => {
    // Handle (none)/!(none) special values
    const nullCheck = checkNullFilter(filter);
    if (nullCheck.isNull) {
      return nullCheck.wantEmpty
        ? `NOT EXISTS (SELECT 1 FROM item_image_details iid WHERE iid.item_id = items.id AND iid.colors IS NOT NULL AND jsonb_array_length(iid.colors) > 0)`
        : `EXISTS (SELECT 1 FROM item_image_details iid WHERE iid.item_id = items.id AND iid.colors IS NOT NULL AND jsonb_array_length(iid.colors) > 0)`;
    }

    const trimmed = filter.value.trim();

    // Check if input is a hex value (starts with #)
    const isHexInput = trimmed.startsWith("#");

    if (isHexInput) {
      // Hex input: use deltaE_lab for perceptual color matching
      const normalizedHex = normalizeColor(trimmed);
      if (!normalizedHex) return null; // Invalid hex

      const lab = hexToLab(normalizedHex);
      if (!lab) return null; // Shouldn't happen if normalizeColor succeeded

      const deltaE = deltaELabSql(ctx.paramIndex);
      const existsBody = `SELECT 1 FROM item_image_details iid
            CROSS JOIN LATERAL jsonb_array_elements(iid.colors) AS c
            WHERE iid.item_id = items.id
            AND (c->>'l') IS NOT NULL
            AND ${deltaE} <= ${COLOR_DELTA_E_THRESHOLD}`;
      const condition = filter.negated
        ? `NOT EXISTS (${existsBody})`
        : `EXISTS (${existsBody})`;

      ctx.params.push(lab.l, lab.a, lab.b);
      ctx.paramIndex += 3;
      return condition;
    }

    // Named color: use exact name matching (faster)
    const colorName = normalizeColorFilterValue(filter.value);
    if (!colorName) return null; // Skip invalid color values

    const condition = filter.negated
      ? `NOT EXISTS (
          SELECT 1 FROM item_image_details iid
          WHERE iid.item_id = items.id
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(iid.colors) c
            WHERE lower(c->>'name') = lower($${ctx.paramIndex})
          )
        )`
      : `EXISTS (
          SELECT 1 FROM item_image_details iid
          WHERE iid.item_id = items.id
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(iid.colors) c
            WHERE lower(c->>'name') = lower($${ctx.paramIndex})
          )
        )`;
    ctx.params.push(colorName);
    ctx.paramIndex++;
    return condition;
  });
}

/**
 * Build a CTE for colour relevance ranking when searching by hex colour.
 *
 * Returns relevance score combining:
 * - Colour proximity (lower deltaE = higher relevance)
 * - Colour dominance (higher score = more prominent in image)
 *
 * Formula: (1 - deltaE/threshold) * score
 *
 * @param filters - Colour filter values (only hex values are considered)
 * @param startParamIndex - Starting parameter index
 * @returns CTE SQL, params, and whether there are any hex filters
 */
export function buildColorRelevanceCte(
  filters: FilterValue[],
  startParamIndex: number,
): { cte: string; params: unknown[]; hasHexFilters: boolean } {
  // Find hex colour filters (non-negated only for ranking)
  const hexFilters = filters.filter((f) => {
    const trimmed = f.value.trim();
    return trimmed.startsWith("#") && !f.negated;
  });

  if (hexFilters.length === 0) {
    return { cte: "", params: [], hasHexFilters: false };
  }

  // For simplicity, use the first hex filter for ranking
  // (multiple hex filters in OR groups would need more complex logic)
  const firstHex = hexFilters[0].value.trim();
  const normalizedHex = normalizeColor(firstHex);
  if (!normalizedHex) {
    return { cte: "", params: [], hasHexFilters: false };
  }

  const lab = hexToLab(normalizedHex);
  if (!lab) {
    return { cte: "", params: [], hasHexFilters: false };
  }

  const deltaE = deltaELabSql(startParamIndex);
  // Compute deltaE once per color using a subquery, then filter and aggregate
  const cte = `
    color_relevance AS (
      SELECT
        item_id,
        MAX(
          (1 - delta_e / ${COLOR_DELTA_E_THRESHOLD}.0) * COALESCE(score, 0.5)
        ) AS relevance
      FROM (
        SELECT
          iid.item_id,
          (c->>'score')::float AS score,
          ${deltaE} AS delta_e
        FROM item_image_details iid
        CROSS JOIN LATERAL jsonb_array_elements(iid.colors) AS c
        WHERE (c->>'l') IS NOT NULL
      ) color_distances
      WHERE delta_e <= ${COLOR_DELTA_E_THRESHOLD}
      GROUP BY item_id
    )`;

  return {
    cte,
    params: [lab.l, lab.a, lab.b],
    hasHexFilters: true,
  };
}

/**
 * Assemble the shared WHERE conditions for a filtered item search.
 *
 * Seeds the conditions with the user scope (`$1`) and folds in every filter
 * type (type, tag, object, source, location, date, color), remapping each
 * fragment's placeholders to the running param index and qualifying the bare
 * column/table references onto the query's items alias.
 *
 * `alias` is the identifier the caller's query gives the `items` table:
 * `"i"` (default) for the ranked search queries (`FROM items i`), or `"items"`
 * for the filters-only query that selects `FROM items` unaliased.
 *
 * Callers append their own trailing params (the query string, the query
 * vector) starting at `nextParamIndex`.
 */
export function buildFilterConditions(
  userId: string,
  filters: ParsedFilters,
  { alias = "i" }: { alias?: string } = {},
): { conditions: string[]; params: unknown[]; nextParamIndex: number } {
  const conditions: string[] = [`${alias}.user_id = $1::uuid`];
  const params: unknown[] = [userId];
  let paramIndex = 2;

  // Type filter
  if (filters.type && filters.type.length > 0) {
    const typeCondition = buildTypeCondition(filters.type);
    if (typeCondition.sql) {
      const remapped = remapParamIndices(
        typeCondition.sql,
        typeCondition.params.length,
        paramIndex,
      );
      // Qualify "kind" onto the items alias
      conditions.push(remapped.replace(/\bkind\b/g, `${alias}.kind`));
      params.push(...typeCondition.params);
      paramIndex += typeCondition.params.length;
    }
  }

  // Tag filter
  if (filters.tag && filters.tag.length > 0) {
    const tagCondition = buildTagCondition(filters.tag, paramIndex);
    if (tagCondition.sql) {
      // Qualify "tags" onto the items alias
      conditions.push(tagCondition.sql.replace(/\btags\b/g, `${alias}.tags`));
      params.push(...tagCondition.params);
      paramIndex += tagCondition.params.length;
    }
  }

  // Object filter
  if (filters.object && filters.object.length > 0) {
    const objectCondition = buildObjectCondition(filters.object, paramIndex);
    if (objectCondition.sql) {
      // Qualify "items.id" onto the items alias
      conditions.push(
        objectCondition.sql.replace(/\bitems\.id\b/g, `${alias}.id`),
      );
      params.push(...objectCondition.params);
      paramIndex += objectCondition.params.length;
    }
  }

  // Source filter
  if (filters.source && filters.source.length > 0) {
    const sourceCondition = buildSourceCondition(filters.source, paramIndex);
    if (sourceCondition.sql) {
      conditions.push(
        sourceCondition.sql.replace(/\bsource_type\b/g, `${alias}.source_type`),
      );
      params.push(...sourceCondition.params);
      paramIndex += sourceCondition.params.length;
    }
  }

  // Location filter
  if (filters.location && filters.location.length > 0) {
    const locationCondition = buildLocationCondition(
      filters.location,
      paramIndex,
    );
    if (locationCondition.sql) {
      conditions.push(
        locationCondition.sql.replace(/\bitems\.id\b/g, `${alias}.id`),
      );
      params.push(...locationCondition.params);
      paramIndex += locationCondition.params.length;
    }
  }

  // Date filter
  if (filters.dateAfter || filters.dateBefore) {
    const dateCondition = buildDateCondition(
      filters.dateAfter,
      filters.dateBefore,
      paramIndex,
    );
    if (dateCondition.sql) {
      conditions.push(dateCondition.sql.replace(/\bitems\./g, `${alias}.`));
      params.push(...dateCondition.params);
      paramIndex += dateCondition.params.length;
    }
  }

  // Color filter
  if (filters.color && filters.color.length > 0) {
    const colorCondition = buildColorCondition(filters.color, paramIndex);
    if (colorCondition.sql) {
      conditions.push(
        colorCondition.sql.replace(/\bitems\.id\b/g, `${alias}.id`),
      );
      params.push(...colorCondition.params);
      paramIndex += colorCondition.params.length;
    }
  }

  return { conditions, params, nextParamIndex: paramIndex };
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
    filters.dateBefore !== undefined
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
