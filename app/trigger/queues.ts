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
 *
 * Throughput note: at limit 2, image analysis drains ~600/hour globally — a
 * launch-scaling ceiling. Raising it needs a higher Replicate rate limit first,
 * and interacts with the project `ttl` (burst tolerance) and the stuck-items
 * reaper threshold — tune them as a set (see trigger.config.ts `ttl` and
 * STUCK_ITEM_THRESHOLD_MS in src/lib/items/reap-stuck-items.ts).
 */
export const imageAnalysisQueue = queue({
  name: "image-analysis",
  concurrencyLimit: 2,
});
