/**
 * "Similar images" search over CLIP visual embeddings (pgvector).
 *
 * Scoped to a single owner's own library, seeded by the source item's already
 * stored embedding (no fresh Replicate call at read time). Runs an EXACT
 * inner-product scan filtered by `user_id` — a personal library is small
 * (hundreds to low thousands of vectors), so exact ordering is both fast and
 * fully accurate. We deliberately do NOT use the HNSW ANN index here: ANN
 * filters distance-first then applies `user_id`, which can under-return for a
 * per-tenant query. If a single user's library ever grows large enough that
 * this scan gets slow, the lever is pgvector 0.8 iterative index scans
 * (`hnsw.iterative_scan`), not a plain HNSW index.
 */

import db from "@/lib/db";
import { VISUAL_EMBEDDING_MODEL } from "@/lib/embeddings";
import { createLogger } from "@/lib/logger.server";

const log = createLogger("lib/search/similar-images");

/**
 * Minimum inner-product similarity for a result to count as "similar".
 *
 * Embeddings are L2-normalized, so inner product ≈ cosine similarity in
 * [-1, 1]. CLIP visual similarity is forgiving, so this sits higher than the
 * text-search threshold to keep out loosely-related photos — we'd rather show
 * fewer, genuinely-alike images than pad the list. Tune after real testing.
 */
export const SIMILAR_IMAGE_MIN_SIMILARITY = 0.7;

/** Default cap on how many similar images to return (2-wide grid). */
export const SIMILAR_IMAGES_LIMIT = 6;

export type SimilarImageResult = {
  id: string;
  similarity: number;
};

type FindSimilarImagesArgs = {
  /** The source item whose embedding seeds the search. */
  itemId: string;
  /** Owner scope — only this user's images are considered. */
  userId: string;
  limit?: number;
  threshold?: number;
};

/**
 * Find the owner's images most visually similar to `itemId`, ordered most to
 * least similar. Excludes the source item itself and anything below
 * `threshold`. Returns an empty array when the source has no visual embedding
 * (e.g. Replicate wasn't configured when it was processed) or nothing passes.
 */
export async function findSimilarImages({
  itemId,
  userId,
  limit = SIMILAR_IMAGES_LIMIT,
  threshold = SIMILAR_IMAGE_MIN_SIMILARITY,
}: FindSimilarImagesArgs): Promise<SimilarImageResult[]> {
  // pgvector `<#>` is negative inner product, so smaller = more similar. Negate
  // to get an ascending-friendly similarity score and order by the raw operator.
  const rows = await db.$queryRaw<Array<{ id: string; similarity: number }>>`
    WITH seed AS (
      SELECT embedding
      FROM item_visual_vectors
      WHERE item_id = ${itemId}::uuid
        AND model = ${VISUAL_EMBEDDING_MODEL}
        AND embedding IS NOT NULL
    )
    SELECT
      iv.item_id AS id,
      (iv.embedding <#> (SELECT embedding FROM seed)) * -1 AS similarity
    FROM item_visual_vectors iv
    WHERE iv.user_id = ${userId}::uuid
      AND iv.model = ${VISUAL_EMBEDDING_MODEL}
      AND iv.item_id <> ${itemId}::uuid
      AND iv.embedding IS NOT NULL
      AND (iv.embedding <#> (SELECT embedding FROM seed)) * -1 >= ${threshold}
    ORDER BY iv.embedding <#> (SELECT embedding FROM seed) ASC
    LIMIT ${limit}
  `;

  log.debug(
    { itemId, userId, resultCount: rows.length },
    "Similar images search completed",
  );

  return rows.map((r) => ({ id: r.id, similarity: Number(r.similarity) }));
}
