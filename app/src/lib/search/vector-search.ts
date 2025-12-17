/**
 * Vector similarity search using pgvector.
 *
 * Queries item_text_vectors using inner product similarity.
 * Uses cached query embeddings to reduce OpenAI API calls.
 */

import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { getQueryEmbedding } from "./embedding-cache";
import type { ParsedFilters } from "./query-builder";
import {
  buildColorCondition,
  buildDateCondition,
  buildLocationCondition,
  buildObjectCondition,
  buildSourceCondition,
  buildTagCondition,
  buildTypeCondition,
  remapParamIndices,
} from "./query-builder";

const log = createLogger("lib/search/vector-search");

export type VectorSearchResult = {
  id: string;
  similarity: number;
};

/**
 * Convert embedding array to pgvector literal format.
 */
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Execute vector similarity search on items.
 *
 * @param userId - User ID to scope search
 * @param filters - Parsed filter conditions
 * @param query - Search query string
 * @param limit - Maximum results to return
 * @returns Array of item IDs with similarity scores
 */
export async function vectorSearch(
  userId: string,
  filters: ParsedFilters,
  query: string,
  limit = 100,
): Promise<VectorSearchResult[]> {
  // Get query embedding (uses cache)
  const queryEmbedding = await getQueryEmbedding(query);

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

  // Color filter
  if (filters.color && filters.color.length > 0) {
    const colorCondition = buildColorCondition(filters.color, paramIndex);
    if (colorCondition.sql) {
      conditions.push(colorCondition.sql.replace(/\bitems\.id\b/g, "i.id"));
      params.push(...colorCondition.params);
      paramIndex += colorCondition.params.length;
    }
  }

  const whereClause = conditions.join(" AND ");
  const vectorLiteral = toVectorLiteral(queryEmbedding);

  // Add vector as a parameter
  const vectorParamIndex = paramIndex;
  params.push(vectorLiteral);

  // Vector similarity search using inner product
  // Higher inner product = more similar (for normalized vectors)
  // We negate to get descending order since pgvector uses ASC for distance
  const searchQuery = `
    SELECT
      i.id,
      (itv.embedding <#> $${vectorParamIndex}::vector) * -1 AS similarity
    FROM items i
    JOIN item_text_vectors itv ON itv.item_id = i.id
    WHERE ${whereClause}
      AND itv.embedding IS NOT NULL
    ORDER BY itv.embedding <#> $${vectorParamIndex}::vector ASC
    LIMIT ${limit}
  `;

  log.debug(
    {
      userId,
      queryLength: query.length,
      filterCount: Object.keys(filters).length,
    },
    "Executing vector search",
  );

  const results = await db.$queryRawUnsafe<
    Array<{
      id: string;
      similarity: number;
    }>
  >(searchQuery, ...params);

  log.debug({ resultCount: results.length }, "Vector search completed");

  return results.map((r) => ({
    id: r.id,
    similarity: r.similarity,
  }));
}
