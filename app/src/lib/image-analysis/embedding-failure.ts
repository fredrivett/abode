import { getAiErrorStatus, isRateLimitError } from "@/lib/ai/retry-transient";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";

/**
 * Where a dropped CLIP embedding originated, so a swallowed failure is
 * attributable in analytics: a plain image upload vs a tweet's cover image.
 */
export type ImageEmbeddingSource = "upload" | "tweet-cover";

/**
 * Which pass dropped the embedding: the initial analysis, or a later heal run
 * regenerating an embedding that a previous pass lost.
 */
export type ImageEmbeddingPhase = "initial" | "heal";

/** Queryable PostHog event name for a swallowed CLIP embedding failure. */
export const IMAGE_EMBEDDING_FAILED_EVENT = "image_embedding_failed";

/**
 * Report a swallowed CLIP visual-embedding failure without failing the caller.
 *
 * The visual embedding is an optional enhancement (see graceful degradation in
 * AGENTS.md): a Replicate failure leaves `embedding: null` and never throws. But
 * silently dropping it hid a real data-quality gap — under load Replicate
 * 429-throttles and ~most embeddings in a burst are lost invisibly. This makes
 * the loss observable two ways: a queryable PostHog event carrying `item_id` +
 * `source` + `failure_kind` (throttle vs error) so the drop rate is measurable,
 * and the usual exception capture for the stack trace. Best-effort — never
 * throws, so it can't turn a degraded embedding into a failed item.
 */
export function reportImageEmbeddingFailure({
  error,
  userId,
  itemId,
  source,
  phase,
  fileKey,
}: {
  error: unknown;
  userId: string;
  itemId: string;
  source: ImageEmbeddingSource;
  phase: ImageEmbeddingPhase;
  /** Present for cover images; included in the exception context only. */
  fileKey?: string;
}): void {
  const status = getAiErrorStatus(error);
  const failureKind = isRateLimitError(error) ? "throttle" : "error";

  // Each telemetry sink is wrapped independently so a throwing PostHog client
  // can't escape this reporter (it runs inside a degraded-embedding catch, where
  // a propagated error would fail the whole analysis) — and so one sink failing
  // doesn't skip the other.
  try {
    getPostHogClient()?.capture({
      distinctId: userId,
      event: IMAGE_EMBEDDING_FAILED_EVENT,
      properties: {
        item_id: itemId,
        source,
        phase,
        failure_kind: failureKind,
        status: status ?? null,
      },
    });
  } catch {
    // Observability must never affect the degraded analysis.
  }

  try {
    captureServerException(error, userId, {
      source: `image-embedding:${source}`,
      itemId,
      phase,
      failure_kind: failureKind,
      ...(fileKey ? { fileKey } : {}),
    });
  } catch {
    // Observability must never affect the degraded analysis.
  }
}
