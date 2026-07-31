import { queue } from "@trigger.dev/sdk";

/**
 * Shared concurrency budget for tasks that call Replicate (CLIP visual
 * embeddings): analyze-image and analyze-media-cover.
 *
 * Replicate throttles under concurrent load. A batch backfill fanning out
 * unbounded analyze-media-cover runs hammered Replicate and ~85% of the
 * embedding calls came back 429 — silently dropped by the graceful-degradation
 * catch, leaving covers with no visual vector. Both Replicate-bound tasks share
 * this one queue so their *combined* concurrency can't overwhelm it.
 */
export const imageAnalysisQueue = queue({
  name: "image-analysis",
  concurrencyLimit: 3,
});
