/**
 * The single seam for recording paid AI usage.
 *
 * Emits a server-side `ai_usage` PostHog event with `cost_usd` computed at
 * emit time from the maintained price table. This is the ONLY future-extension
 * point — a DB ledger and monthly reconciliation will hook in here later, so
 * every paid call site should route through `recordAiUsage` rather than
 * calling PostHog directly.
 *
 * Graceful degradation (see CLAUDE.md → Optional Services): recording must
 * NEVER fail the surrounding enrichment/analysis work. No PostHog key (or dev)
 * → no-op; `capture` throws → caught + reported + continue; unknown model →
 * `cost_usd: null` + warn, event still emitted.
 */

import type { ItemKind } from "@prisma/client";
import {
  googleVisionCostUsd,
  openAiChatCostUsd,
  openAiEmbeddingCostUsd,
  replicateImageCostUsd,
} from "@/lib/ai-costs/prices";
import { createLogger } from "@/lib/logger.server";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { accrueUsageCost } from "@/lib/usage-limits";

const log = createLogger("lib/ai-costs/record-ai-usage");

export type AiProvider = "openai" | "replicate" | "google_vision";
export type AiOperation =
  | "text_embedding"
  | "image_embedding"
  | "vision_analysis"
  | "image_filtering"
  | "translation";
export type AiUsageSource = "ingestion" | "search";

export interface RecordAiUsageParams {
  userId: string;
  itemId?: string;
  itemKind?: ItemKind | null;
  provider: AiProvider;
  operation: AiOperation;
  model: string;
  /** Chat/vision input tokens */
  inputTokens?: number;
  /** Chat/vision output tokens */
  outputTokens?: number;
  /** Embedding total tokens */
  totalTokens?: number;
  /** Per-image / per-feature providers (default 1) */
  images?: number;
  /** Where the call originated (default "ingestion") */
  source?: AiUsageSource;
}

/**
 * Compute `cost_usd` for a usage record, or `null` when the model isn't priced.
 * Picks the calculator by provider/operation.
 */
function computeCostUsd(params: RecordAiUsageParams): number | null {
  const {
    provider,
    operation,
    model,
    inputTokens = 0,
    outputTokens = 0,
    totalTokens = 0,
    images = 1,
  } = params;

  if (provider === "openai") {
    if (operation === "text_embedding") {
      return openAiEmbeddingCostUsd(model, totalTokens);
    }
    // vision_analysis / image_filtering — both are chat-model calls
    return openAiChatCostUsd(model, inputTokens, outputTokens);
  }
  if (provider === "replicate") {
    return replicateImageCostUsd(model, images);
  }
  if (provider === "google_vision") {
    return googleVisionCostUsd(model, images);
  }
  return null;
}

/**
 * Record a paid AI call. Never throws — a recording failure must not fail the
 * enrichment work that produced it.
 */
export function recordAiUsage(params: RecordAiUsageParams): void {
  try {
    const {
      userId,
      itemId,
      itemKind = null,
      provider,
      operation,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      images,
      source = "ingestion",
    } = params;

    const costUsd = computeCostUsd(params);

    if (costUsd === null) {
      log.warn(
        { provider, operation, model },
        "No price for AI model — emitting ai_usage with cost_usd: null",
      );
    }

    // Accrue the paid $ onto the durable daily rollup (secondary spend backstop)
    // BEFORE the analytics capture, so a throwing PostHog client can't skip the
    // durable write. Best-effort and fire-and-forget — accrueUsageCost never throws.
    if (costUsd !== null && costUsd > 0) {
      const bucket = source === "search" ? "search" : "ingestion";
      void accrueUsageCost(userId, bucket, costUsd);
    }

    getPostHogClient()?.capture({
      distinctId: userId,
      event: "ai_usage",
      properties: {
        provider,
        operation,
        model,
        tokens_input: inputTokens ?? null,
        tokens_output: outputTokens ?? null,
        tokens_total: totalTokens ?? null,
        images: images ?? null,
        cost_usd: costUsd,
        item_id: itemId ?? null,
        item_kind: itemKind,
        source,
      },
    });
  } catch (error) {
    // Recording is best-effort — report and continue, never fail the caller.
    log.warn({ error }, "Failed to record AI usage");
    captureServerException(error, params.userId, {
      source: "record-ai-usage",
      provider: params.provider,
      operation: params.operation,
    });
  }
}
