import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { fullTextSearch } from "@/lib/search/full-text-search";
import {
  buildDateCondition,
  buildLocationCondition,
  buildObjectCondition,
  buildSourceCondition,
  buildTagCondition,
  buildTypeCondition,
  type ColorMatch,
  filterByColor,
  hasFilters,
  type ParsedFilters,
  parseFiltersFromParams,
} from "@/lib/search/query-builder";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/v1/search");

const PAGE_SIZE = 20;
const MAX_RANKED_RESULTS = 100;

type SearchWarning =
  | "vector_search_unavailable"
  | "rate_limited"
  | "partial_results"
  | "slow_query";

type MatchReason = {
  field: string | null;
  value?: string;
  snippet?: string;
  proximity?: number;
};

type SearchResultItem = {
  id: string;
  kind: string | null;
  fileKey: string | null;
  coverFileKey: string | null;
  title: string | null;
  tags: string[];
  colors: Array<{ hex: string; percentage: number }> | null;
  createdAt: string;
  match: {
    reasons: MatchReason[];
  };
};

type CursorData = {
  captureDate: string | null;
  createdAt: string;
  id: string;
};

type SearchResponse = {
  items: SearchResultItem[];
  total: number;
  cursor?: string;
  warnings?: SearchWarning[];
};

function encodeCursor(data: CursorData): string {
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}

function decodeCursor(cursor: string): CursorData | null {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * GET /api/v1/search
 *
 * Main search endpoint with two modes:
 * 1. Filters only (no `q` param): Standard DB query with cursor pagination
 * 2. Free text search (has `q` param): Full-text + vector search with RRF ranking
 *
 * Requires at least one filter or query parameter.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const warnings: SearchWarning[] = [];

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const cursor = searchParams.get("cursor");
    const filters = parseFiltersFromParams(searchParams);

    // Require at least one filter or query
    if (!query && !hasFilters(filters)) {
      return NextResponse.json(
        { message: "At least one filter or query parameter is required" },
        { status: 400 },
      );
    }

    let results: {
      items: SearchResultItem[];
      total: number;
      cursor?: string;
    };

    if (query) {
      // Text search mode: Full-text search (vector search will be added in Chunk 5-6)
      results = await executeRankedSearch(user.id, filters, query, warnings);
    } else {
      // Filters-only mode with cursor pagination
      results = await executeFiltersOnlySearch(user.id, filters, cursor);
    }

    // Check for slow query
    if (Date.now() - startTime > 3000) {
      warnings.push("slow_query");
    }

    const response: SearchResponse = {
      items: results.items,
      total: results.total,
      ...(results.cursor && { cursor: results.cursor }),
      ...(warnings.length > 0 && { warnings }),
    };

    return NextResponse.json(response);
  } catch (error) {
    log.error({ error }, "Search error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

async function executeFiltersOnlySearch(
  userId: string,
  filters: ParsedFilters,
  cursor: string | null,
): Promise<{ items: SearchResultItem[]; total: number; cursor?: string }> {
  // Build WHERE conditions
  const conditions: string[] = ["user_id = $1::uuid", "deleted_at IS NULL"];
  const params: unknown[] = [userId];
  let paramIndex = 2;

  // Type filter
  if (filters.type && filters.type.length > 0) {
    const typeCondition = buildTypeCondition(filters.type);
    if (typeCondition.sql) {
      // Remap parameter indices
      const remapped = remapParamIndices(
        typeCondition.sql,
        typeCondition.params.length,
        paramIndex,
      );
      conditions.push(remapped);
      params.push(...typeCondition.params);
      paramIndex += typeCondition.params.length;
    }
  }

  // Tag filter
  if (filters.tag && filters.tag.length > 0) {
    const tagCondition = buildTagCondition(filters.tag, paramIndex);
    if (tagCondition.sql) {
      conditions.push(tagCondition.sql);
      params.push(...tagCondition.params);
      paramIndex += tagCondition.params.length;
    }
  }

  // Object filter
  if (filters.object && filters.object.length > 0) {
    const objectCondition = buildObjectCondition(filters.object, paramIndex);
    if (objectCondition.sql) {
      conditions.push(objectCondition.sql);
      params.push(...objectCondition.params);
      paramIndex += objectCondition.params.length;
    }
  }

  // Source filter
  if (filters.source && filters.source.length > 0) {
    const sourceCondition = buildSourceCondition(filters.source, paramIndex);
    if (sourceCondition.sql) {
      conditions.push(sourceCondition.sql);
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
      conditions.push(locationCondition.sql);
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
      conditions.push(dateCondition.sql);
      params.push(...dateCondition.params);
      paramIndex += dateCondition.params.length;
    }
  }

  // OCR filter - use full-text search on ocr_text
  if (filters.ocr) {
    conditions.push(`EXISTS (
      SELECT 1 FROM item_image_details iid
      WHERE iid.item_id = items.id
      AND to_tsvector('english', COALESCE(iid.ocr_text, '')) @@ plainto_tsquery('english', $${paramIndex})
    )`);
    params.push(filters.ocr);
    paramIndex++;
  }

  // Cursor pagination
  let cursorCondition = "";
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData) {
      // Order by capture_date (with fallback to created_at), then created_at, then id
      cursorCondition = `AND (
        COALESCE(
          (SELECT iid.capture_date FROM item_image_details iid WHERE iid.item_id = items.id),
          items.created_at
        ),
        items.created_at,
        items.id
      ) < (
        ${cursorData.captureDate ? `$${paramIndex}::timestamp` : "NULL"},
        $${paramIndex + 1}::timestamp,
        $${paramIndex + 2}::uuid
      )`;
      if (cursorData.captureDate) {
        params.push(cursorData.captureDate);
        paramIndex++;
      }
      params.push(cursorData.createdAt);
      paramIndex++;
      params.push(cursorData.id);
      paramIndex++;
    }
  }

  const whereClause = conditions.join(" AND ");

  // Color filter is handled post-query, so we need to fetch more items if color filter is present
  const hasColorFilter = filters.color && filters.color.length > 0;
  const fetchLimit = hasColorFilter ? PAGE_SIZE * 5 : PAGE_SIZE + 1; // Fetch extra for color filtering

  // Query items
  const itemsQuery = `
    SELECT
      items.id,
      items.kind,
      items.file_key,
      items.cover_file_key,
      items.title,
      items.tags,
      items.created_at,
      iid.colors,
      iid.capture_date
    FROM items
    LEFT JOIN item_image_details iid ON iid.item_id = items.id
    WHERE ${whereClause}
    ${cursorCondition}
    ORDER BY
      COALESCE(iid.capture_date, items.created_at) DESC,
      items.created_at DESC,
      items.id DESC
    LIMIT ${fetchLimit}
  `;

  const rawItems = await db.$queryRawUnsafe<
    Array<{
      id: string;
      kind: string | null;
      file_key: string | null;
      cover_file_key: string | null;
      title: string | null;
      tags: string[];
      created_at: Date;
      colors: unknown;
      capture_date: Date | null;
    }>
  >(itemsQuery, ...params);

  // Parse colors JSON
  let items = rawItems.map((item) => ({
    ...item,
    colors: parseColors(item.colors),
  }));

  // Apply color filter post-query
  let colorMatches: Map<string, ColorMatch> = new Map();
  if (hasColorFilter && filters.color) {
    const { filteredIds, matches } = filterByColor(
      items.map((i) => ({ id: i.id, colors: i.colors })),
      filters.color,
    );
    items = items.filter((i) => filteredIds.has(i.id));
    colorMatches = matches;
  }

  // Check if there are more results
  const hasMore = items.length > PAGE_SIZE;
  const pageItems = items.slice(0, PAGE_SIZE);

  // Build match reasons based on filters
  const buildMatchReasons = (itemId: string): MatchReason[] => {
    const reasons: MatchReason[] = [];

    if (filters.type && filters.type.length > 0) {
      for (const f of filters.type) {
        if (!f.negated) {
          reasons.push({ field: "type", value: f.value });
        }
      }
    }

    if (filters.tag && filters.tag.length > 0) {
      for (const f of filters.tag) {
        if (!f.negated) {
          reasons.push({ field: "tags", value: f.value });
        }
      }
    }

    if (filters.object && filters.object.length > 0) {
      for (const f of filters.object) {
        if (!f.negated) {
          reasons.push({ field: "objects", value: f.value });
        }
      }
    }

    if (filters.source && filters.source.length > 0) {
      for (const f of filters.source) {
        if (!f.negated) {
          reasons.push({ field: "source", value: f.value });
        }
      }
    }

    if (filters.location && filters.location.length > 0) {
      for (const f of filters.location) {
        if (!f.negated) {
          reasons.push({ field: "location", value: f.value });
        }
      }
    }

    const colorMatch = colorMatches.get(itemId);
    if (colorMatch) {
      reasons.push({
        field: "colors",
        value: colorMatch.hex,
        proximity: colorMatch.proximity,
      });
    }

    return reasons;
  };

  // Format response
  const resultItems: SearchResultItem[] = pageItems.map((item) => ({
    id: item.id,
    kind: item.kind,
    fileKey: item.file_key,
    coverFileKey: item.cover_file_key,
    title: item.title,
    tags: item.tags || [],
    colors: item.colors,
    createdAt: item.created_at.toISOString(),
    match: {
      reasons: buildMatchReasons(item.id),
    },
  }));

  // Generate cursor for next page
  let nextCursor: string | undefined;
  if (hasMore && pageItems.length > 0) {
    const lastItem = pageItems[pageItems.length - 1];
    nextCursor = encodeCursor({
      captureDate: lastItem.capture_date?.toISOString() || null,
      createdAt: lastItem.created_at.toISOString(),
      id: lastItem.id,
    });
  }

  // Get total count (without pagination)
  const countQuery = `
    SELECT COUNT(*) as count
    FROM items
    LEFT JOIN item_image_details iid ON iid.item_id = items.id
    WHERE ${whereClause}
  `;
  const countResult = await db.$queryRawUnsafe<[{ count: bigint }]>(
    countQuery,
    ...params.slice(0, paramIndex - (cursor ? 3 : 0)), // Exclude cursor params
  );
  const total = Number(countResult[0].count);

  return {
    items: resultItems,
    total,
    cursor: nextCursor,
  };
}

/**
 * Execute ranked search using full-text search.
 * Vector search and RRF will be added in Chunks 5-6.
 */
async function executeRankedSearch(
  userId: string,
  filters: ParsedFilters,
  query: string,
  _warnings: SearchWarning[], // Will be used in Chunks 5-6 for vector_search_unavailable
): Promise<{ items: SearchResultItem[]; total: number }> {
  // Execute full-text search
  const textResults = await fullTextSearch(
    userId,
    filters,
    query,
    MAX_RANKED_RESULTS,
  );

  if (textResults.length === 0) {
    return { items: [], total: 0 };
  }

  // Build a map of OCR snippets from full-text results
  const ocrSnippets = new Map<string, string>();
  for (const result of textResults) {
    if (result.ocrSnippet) {
      ocrSnippets.set(result.id, result.ocrSnippet);
    }
  }

  // Fetch full item data for the search results
  const itemIds = textResults.map((r) => r.id);

  const items = await db.$queryRawUnsafe<
    Array<{
      id: string;
      kind: string | null;
      file_key: string | null;
      cover_file_key: string | null;
      title: string | null;
      tags: string[];
      created_at: Date;
      colors: unknown;
    }>
  >(
    `
    SELECT
      i.id,
      i.kind,
      i.file_key,
      i.cover_file_key,
      i.title,
      i.tags,
      i.created_at,
      iid.colors
    FROM items i
    LEFT JOIN item_image_details iid ON iid.item_id = i.id
    WHERE i.id = ANY($1::uuid[])
  `,
    itemIds,
  );

  // Create a map for quick lookup
  const itemMap = new Map(items.map((item) => [item.id, item]));

  // Apply color filter if present
  let colorMatches = new Map<string, ColorMatch>();
  let filteredItemIds = new Set(itemIds);

  if (filters.color && filters.color.length > 0) {
    const itemsWithColors = items.map((item) => ({
      id: item.id,
      colors: parseColors(item.colors),
    }));
    const { filteredIds, matches } = filterByColor(
      itemsWithColors,
      filters.color,
    );
    filteredItemIds = filteredIds;
    colorMatches = matches;
  }

  // Build result items in rank order, excluding filtered-out items
  const resultItems: SearchResultItem[] = [];
  for (const result of textResults) {
    if (!filteredItemIds.has(result.id)) continue;

    const item = itemMap.get(result.id);
    if (!item) continue;

    const ocrSnippet = ocrSnippets.get(result.id);
    const colorMatch = colorMatches.get(result.id);

    // Build match reasons
    const reasons: MatchReason[] = [];

    // Add text search match reason (null field indicates semantic/text match)
    if (ocrSnippet) {
      reasons.push({
        field: "ocrText",
        snippet: ocrSnippet,
      });
    } else {
      // Text matched in title, tags, or description
      reasons.push({
        field: null, // indicates full-text match across multiple fields
        value: query,
      });
    }

    // Add filter-based match reasons
    if (filters.type) {
      for (const f of filters.type) {
        if (!f.negated) reasons.push({ field: "type", value: f.value });
      }
    }
    if (filters.tag) {
      for (const f of filters.tag) {
        if (!f.negated) reasons.push({ field: "tags", value: f.value });
      }
    }
    if (filters.object) {
      for (const f of filters.object) {
        if (!f.negated) reasons.push({ field: "objects", value: f.value });
      }
    }
    if (filters.source) {
      for (const f of filters.source) {
        if (!f.negated) reasons.push({ field: "source", value: f.value });
      }
    }
    if (filters.location) {
      for (const f of filters.location) {
        if (!f.negated) reasons.push({ field: "location", value: f.value });
      }
    }
    if (colorMatch) {
      reasons.push({
        field: "colors",
        value: colorMatch.hex,
        proximity: colorMatch.proximity,
      });
    }

    resultItems.push({
      id: item.id,
      kind: item.kind,
      fileKey: item.file_key,
      coverFileKey: item.cover_file_key,
      title: item.title,
      tags: item.tags || [],
      colors: parseColors(item.colors),
      createdAt: item.created_at.toISOString(),
      match: { reasons },
    });
  }

  return {
    items: resultItems,
    total: resultItems.length,
  };
}

/**
 * Remap parameter indices in SQL string from 1-based to new start index.
 */
function remapParamIndices(
  sql: string,
  paramCount: number,
  newStartIndex: number,
): string {
  let result = sql;
  // Replace in reverse order to avoid double-replacing
  for (let i = paramCount; i >= 1; i--) {
    result = result.replace(
      new RegExp(`\\$${i}`, "g"),
      `$${newStartIndex + i - 1}`,
    );
  }
  return result;
}

/**
 * Parse colors from database (could be string or object).
 */
function parseColors(
  colors: unknown,
): Array<{ hex: string; percentage: number }> | null {
  if (!colors) return null;
  if (Array.isArray(colors)) {
    return colors as Array<{ hex: string; percentage: number }>;
  }
  if (typeof colors === "string") {
    try {
      return JSON.parse(colors);
    } catch {
      return null;
    }
  }
  return null;
}
