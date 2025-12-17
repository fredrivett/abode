/**
 * Full-text search using PostgreSQL tsvector.
 *
 * Uses plainto_tsquery for simple AND matching (e.g., "blue car" finds items with both words).
 * Results are ranked using ts_rank_cd with weights.
 */

import db from "@/lib/db";
import type { ParsedFilters } from "./query-builder";
import {
  buildDateCondition,
  buildLocationCondition,
  buildObjectCondition,
  buildSourceCondition,
  buildTagCondition,
  buildTypeCondition,
} from "./query-builder";

export type FullTextResult = {
  id: string;
  rank: number;
  ocrSnippet: string | null;
};

export type OcrSearchResult = {
  id: string;
  rank: number;
  snippet: string;
};

/**
 * Execute full-text search on items.
 *
 * @param userId - User ID to scope search
 * @param filters - Parsed filter conditions
 * @param query - Search query string
 * @param limit - Maximum results to return
 * @returns Array of item IDs with rank scores and OCR snippets
 */
export async function fullTextSearch(
  userId: string,
  filters: ParsedFilters,
  query: string,
  limit = 100,
): Promise<FullTextResult[]> {
  // Build WHERE conditions for filters
  const conditions: string[] = ["i.user_id = $1::uuid", "i.deleted_at IS NULL"];
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
      // Replace "kind" with "i.kind" for table alias
      conditions.push(remapped.replace(/\bkind\b/g, "i.kind"));
      params.push(...typeCondition.params);
      paramIndex += typeCondition.params.length;
    }
  }

  // Tag filter
  if (filters.tag && filters.tag.length > 0) {
    const tagCondition = buildTagCondition(filters.tag, paramIndex);
    if (tagCondition.sql) {
      // Replace "tags" with "i.tags" for table alias
      conditions.push(tagCondition.sql.replace(/\btags\b/g, "i.tags"));
      params.push(...tagCondition.params);
      paramIndex += tagCondition.params.length;
    }
  }

  // Object filter
  if (filters.object && filters.object.length > 0) {
    const objectCondition = buildObjectCondition(filters.object, paramIndex);
    if (objectCondition.sql) {
      // Replace "items.id" with "i.id" for table alias
      conditions.push(objectCondition.sql.replace(/\bitems\.id\b/g, "i.id"));
      params.push(...objectCondition.params);
      paramIndex += objectCondition.params.length;
    }
  }

  // Source filter
  if (filters.source && filters.source.length > 0) {
    const sourceCondition = buildSourceCondition(filters.source, paramIndex);
    if (sourceCondition.sql) {
      conditions.push(
        sourceCondition.sql.replace(/\bsource_type\b/g, "i.source_type"),
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
      conditions.push(locationCondition.sql.replace(/\bitems\.id\b/g, "i.id"));
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
      conditions.push(dateCondition.sql.replace(/\bitems\./g, "i."));
      params.push(...dateCondition.params);
      paramIndex += dateCondition.params.length;
    }
  }

  // Add the query parameter for full-text search
  const queryParamIndex = paramIndex;
  params.push(query);
  paramIndex++;

  const whereClause = conditions.join(" AND ");

  // Full-text search query with ranking
  // Uses ts_rank_cd for cover density ranking (better for multi-word matches)
  // Also generates OCR snippet using ts_headline
  const searchQuery = `
    SELECT
      i.id,
      ts_rank_cd(i.search_vector, plainto_tsquery('english', $${queryParamIndex})) AS rank,
      ts_headline(
        'english',
        COALESCE(iid.ocr_text, ''),
        plainto_tsquery('english', $${queryParamIndex}),
        'MaxWords=35, MinWords=15, ShortWord=3, HighlightAll=FALSE, MaxFragments=1, FragmentDelimiter=" ... "'
      ) AS ocr_snippet
    FROM items i
    LEFT JOIN item_image_details iid ON iid.item_id = i.id
    WHERE ${whereClause}
      AND i.search_vector @@ plainto_tsquery('english', $${queryParamIndex})
    ORDER BY rank DESC
    LIMIT ${limit}
  `;

  const results = await db.$queryRawUnsafe<
    Array<{
      id: string;
      rank: number;
      ocr_snippet: string;
    }>
  >(searchQuery, ...params);

  return results.map((r) => ({
    id: r.id,
    rank: r.rank,
    // Only include snippet if it has highlighted terms (contains <b> tags)
    ocrSnippet: r.ocr_snippet?.includes("<b>") ? r.ocr_snippet : null,
  }));
}

/**
 * Execute full-text search on OCR text specifically.
 *
 * This runs separately from the main full-text search to find items
 * where the query matches OCR content. Results are merged via RRF.
 *
 * NOTE: We must apply filters here (not just post-merge) because OCR-only
 * matches would otherwise bypass filters. For example, searching
 * "@tag:vacation receipt" should only return items tagged "vacation" that
 * have "receipt" in OCR - not all items with "receipt" in OCR.
 *
 * @param userId - User ID to scope search
 * @param filters - Parsed filter conditions
 * @param query - Search query string
 * @param limit - Maximum results to return
 * @returns Array of item IDs with rank scores and OCR snippets
 */
export async function ocrTextSearch(
  userId: string,
  filters: ParsedFilters,
  query: string,
  limit = 100,
): Promise<OcrSearchResult[]> {
  // Build WHERE conditions for filters
  // Filters are required here to ensure OCR-only matches respect user's filter criteria
  const conditions: string[] = ["i.user_id = $1::uuid", "i.deleted_at IS NULL"];
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
      conditions.push(remapped.replace(/\bkind\b/g, "i.kind"));
      params.push(...typeCondition.params);
      paramIndex += typeCondition.params.length;
    }
  }

  // Tag filter
  if (filters.tag && filters.tag.length > 0) {
    const tagCondition = buildTagCondition(filters.tag, paramIndex);
    if (tagCondition.sql) {
      conditions.push(tagCondition.sql.replace(/\btags\b/g, "i.tags"));
      params.push(...tagCondition.params);
      paramIndex += tagCondition.params.length;
    }
  }

  // Object filter
  if (filters.object && filters.object.length > 0) {
    const objectCondition = buildObjectCondition(filters.object, paramIndex);
    if (objectCondition.sql) {
      conditions.push(objectCondition.sql.replace(/\bitems\.id\b/g, "i.id"));
      params.push(...objectCondition.params);
      paramIndex += objectCondition.params.length;
    }
  }

  // Source filter
  if (filters.source && filters.source.length > 0) {
    const sourceCondition = buildSourceCondition(filters.source, paramIndex);
    if (sourceCondition.sql) {
      conditions.push(
        sourceCondition.sql.replace(/\bsource_type\b/g, "i.source_type"),
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
      conditions.push(locationCondition.sql.replace(/\bitems\.id\b/g, "i.id"));
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
      conditions.push(dateCondition.sql.replace(/\bitems\./g, "i."));
      params.push(...dateCondition.params);
      paramIndex += dateCondition.params.length;
    }
  }

  // Add the query parameter for OCR full-text search
  const queryParamIndex = paramIndex;
  params.push(query);

  const whereClause = conditions.join(" AND ");

  // OCR-specific full-text search
  const searchQuery = `
    SELECT
      i.id,
      ts_rank_cd(to_tsvector('english', COALESCE(iid.ocr_text, '')), plainto_tsquery('english', $${queryParamIndex})) AS rank,
      ts_headline(
        'english',
        COALESCE(iid.ocr_text, ''),
        plainto_tsquery('english', $${queryParamIndex}),
        'MaxWords=35, MinWords=15, ShortWord=3, HighlightAll=FALSE, MaxFragments=1, FragmentDelimiter=" ... "'
      ) AS snippet
    FROM items i
    JOIN item_image_details iid ON iid.item_id = i.id
    WHERE ${whereClause}
      AND iid.ocr_text IS NOT NULL
      AND to_tsvector('english', iid.ocr_text) @@ plainto_tsquery('english', $${queryParamIndex})
    ORDER BY rank DESC
    LIMIT ${limit}
  `;

  const results = await db.$queryRawUnsafe<
    Array<{
      id: string;
      rank: number;
      snippet: string;
    }>
  >(searchQuery, ...params);

  return results.map((r) => ({
    id: r.id,
    rank: r.rank,
    snippet: r.snippet,
  }));
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
