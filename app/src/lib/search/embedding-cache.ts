/**
 * LRU cache for query embeddings.
 *
 * Caches query text → embedding vector mappings to reduce OpenAI API calls.
 * No invalidation needed because the same query always produces the same embedding.
 */

import { LRUCache } from "lru-cache";
import { generateTextEmbedding } from "@/lib/embeddings";
import { createLogger } from "@/lib/logger.server";

const log = createLogger("lib/search/embedding-cache");

// Cache configuration
const MAX_CACHED_QUERIES = 1000;
const TTL_MS = 60 * 60 * 1000; // 1 hour (for memory management only)

// Singleton cache instance
const queryEmbeddingCache = new LRUCache<string, number[]>({
  max: MAX_CACHED_QUERIES,
  ttl: TTL_MS,
});

/**
 * Get embedding for a search query, using cache if available.
 *
 * @param query - Search query string
 * @returns Embedding vector (1536 dimensions)
 * @throws If embedding generation fails
 */
export async function getQueryEmbedding(query: string): Promise<number[]> {
  const normalized = query.toLowerCase().trim();

  // Check cache
  const cached = queryEmbeddingCache.get(normalized);
  if (cached) {
    log.debug({ query: normalized }, "Query embedding cache hit");
    return cached;
  }

  log.debug({ query: normalized }, "Query embedding cache miss, generating");

  // Generate new embedding
  // NOTE: search-side AI usage is intentionally not recorded here yet — this
  // path has no userId in scope and is LRU-cached (low volume). Deferred to a
  // follow-up that threads userId through the search stack.
  const { embedding } = await generateTextEmbedding(normalized);

  // Cache the result
  queryEmbeddingCache.set(normalized, embedding);

  return embedding;
}

/**
 * Get cache statistics for monitoring.
 */
export function getEmbeddingCacheStats(): {
  size: number;
  maxSize: number;
  calculatedSize: number;
} {
  return {
    size: queryEmbeddingCache.size,
    maxSize: MAX_CACHED_QUERIES,
    calculatedSize: queryEmbeddingCache.calculatedSize,
  };
}

/**
 * Clear the embedding cache (for testing).
 */
export function clearEmbeddingCache(): void {
  queryEmbeddingCache.clear();
}
