/**
 * Full-text search using PostgreSQL tsvector.
 *
 * Uses plainto_tsquery for simple AND matching (e.g., "blue car" finds items with both words).
 * Results are ranked using ts_rank_cd with weights.
 */

import db from "@/lib/db";
import { buildFilterConditions, type ParsedFilters } from "./query-builder";

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
  const { conditions, params, nextParamIndex } = buildFilterConditions(
    userId,
    filters,
  );
  let paramIndex = nextParamIndex;

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
  const { conditions, params, nextParamIndex } = buildFilterConditions(
    userId,
    filters,
  );

  // Add the query parameter for OCR full-text search
  const queryParamIndex = nextParamIndex;
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
