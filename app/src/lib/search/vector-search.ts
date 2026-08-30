/**
 * Vector similarity search using pgvector.
 *
 * Queries item_text_vectors using inner product similarity.
 * Uses cached query embeddings to reduce OpenAI API calls.
 */

import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { getQueryEmbedding } from "./embedding-cache";
import { buildFilterConditions, type ParsedFilters } from "./query-builder";

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
 * Minimum similarity threshold for vector search results.
 * Results below this threshold are filtered out to avoid returning
 * irrelevant items when there are no good semantic matches.
 *
 * Inner product on normalized vectors yields values roughly in [0, 1].
 * A threshold of 0.3 filters out poor matches while keeping reasonable ones.
 */
const MIN_SIMILARITY_THRESHOLD = 0.3;

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
  const { conditions, params, nextParamIndex } = buildFilterConditions(
    userId,
    filters,
  );

  const whereClause = conditions.join(" AND ");
  const vectorLiteral = toVectorLiteral(queryEmbedding);

  // Add vector as a parameter
  const vectorParamIndex = nextParamIndex;
  params.push(vectorLiteral);

  // Vector similarity search using inner product
  // Higher inner product = more similar (for normalized vectors)
  // We negate to get descending order since pgvector uses ASC for distance
  // Filter by minimum similarity threshold to avoid returning irrelevant results
  const searchQuery = `
    SELECT
      i.id,
      (itv.embedding <#> $${vectorParamIndex}::vector) * -1 AS similarity
    FROM items i
    JOIN item_text_vectors itv ON itv.item_id = i.id
    WHERE ${whereClause}
      AND itv.embedding IS NOT NULL
      AND (itv.embedding <#> $${vectorParamIndex}::vector) * -1 >= ${MIN_SIMILARITY_THRESHOLD}
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
