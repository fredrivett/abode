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
 * Minimum RAW inner-product similarity — the fallback cutoff used only when no
 * corpus mean is available yet (fresh/self-hosted deploy before the first mean
 * refresh). Raw CLIP scores sit on a ~0.53 noise floor, so this is high.
 */
export const SIMILAR_IMAGE_MIN_SIMILARITY = 0.7;

/**
 * Minimum CENTERED similarity — the normal cutoff once the corpus mean exists.
 * Subtracting the mean removes the ~0.53 shared-cone component, so scores land
 * in a lower, better-separated band. Calibrated on a labelled eval (~precision
 * 0.41 / recall 0.39 at 0.40); tune here as the corpus grows.
 */
export const SIMILAR_IMAGE_MIN_SIMILARITY_CENTERED = 0.4;

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
 * least similar. Excludes the source item and anything below threshold. Returns
 * an empty array when the source has no visual embedding (e.g. Replicate wasn't
 * configured) or nothing passes.
 *
 * Scores against the mean-CENTERED embedding when a corpus mean is available
 * (`visual_embedding_stats`): raw CLIP vectors sit in a narrow cone where a
 * shared component dominates the score and ranks unrelated images above genuine
 * matches, so we subtract the mean and renormalize (`l2_normalize`) at read
 * time. Falls back to raw inner product when no mean exists yet, each with its
 * own default threshold. Pass an explicit `threshold` to override both (the
 * admin inspector passes a very low value to surface near-misses).
 */
export async function findSimilarImages({
  itemId,
  userId,
  limit = SIMILAR_IMAGES_LIMIT,
  threshold,
}: FindSimilarImagesArgs): Promise<SimilarImageResult[]> {
  // An explicit threshold overrides both branches; otherwise each regime uses
  // its own calibrated default (centered scores live in a lower band than raw).
  const rawThreshold = threshold ?? SIMILAR_IMAGE_MIN_SIMILARITY;
  const centeredThreshold = threshold ?? SIMILAR_IMAGE_MIN_SIMILARITY_CENTERED;

  // pgvector `<#>` is negative inner product, so we negate to a higher-is-better
  // similarity. `mu` is the corpus centroid (0 rows ⇒ centering unavailable ⇒
  // raw fallback), applied identically to seed + candidates so the ranking is
  // always self-consistent within a query.
  const rows = await db.$queryRaw<Array<{ id: string; similarity: number }>>`
    WITH mu AS (
      SELECT "mean_embedding" AS v
      FROM "visual_embedding_stats"
      WHERE "model" = ${VISUAL_EMBEDDING_MODEL}
        AND "mean_embedding" IS NOT NULL
    ),
    seed AS (
      SELECT embedding
      FROM item_visual_vectors
      WHERE item_id = ${itemId}::uuid
        AND model = ${VISUAL_EMBEDDING_MODEL}
        AND embedding IS NOT NULL
    ),
    scored AS (
      SELECT
        iv.item_id AS id,
        ((SELECT v FROM mu) IS NOT NULL) AS centered,
        CASE
          WHEN (SELECT v FROM mu) IS NOT NULL THEN
            (l2_normalize(iv.embedding - (SELECT v FROM mu))
              <#> l2_normalize((SELECT embedding FROM seed) - (SELECT v FROM mu))) * -1
          ELSE
            (iv.embedding <#> (SELECT embedding FROM seed)) * -1
        END AS similarity
      FROM item_visual_vectors iv
      WHERE iv.user_id = ${userId}::uuid
        AND iv.model = ${VISUAL_EMBEDDING_MODEL}
        AND iv.item_id <> ${itemId}::uuid
        AND iv.embedding IS NOT NULL
    )
    SELECT id, similarity
    FROM scored
    WHERE similarity >= CASE WHEN centered THEN ${centeredThreshold} ELSE ${rawThreshold} END
    ORDER BY similarity DESC
    LIMIT ${limit}
  `;

  log.debug(
    { itemId, userId, resultCount: rows.length },
    "Similar images search completed",
  );

  return rows.map((r) => ({ id: r.id, similarity: Number(r.similarity) }));
}
