import { queue } from "@trigger.dev/sdk";

/**
 * Shared concurrency budget for tasks that call Replicate (CLIP visual
 * embeddings): analyze-image and analyze-media-cover.
 *
 * Replicate rate-limits prediction creation aggressively — a burst of concurrent
 * calls comes back 429 ("Request was throttled"). Both Replicate-bound tasks
 * share this one queue so their *combined* concurrency stays under that limit.
 * Kept low (2): the 429 is on request *rate*, and a backfill fans out enough
 * work to sit at the ceiling for minutes. A transient 429 that still slips
 * through is retried with backoff (see `retryTransient`), which also spaces out
 * the retries so we stop provoking the limit.
 */
export const imageAnalysisQueue = queue({
  name: "image-analysis",
  concurrencyLimit: 2,
});
