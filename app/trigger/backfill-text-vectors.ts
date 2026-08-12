/**
 * Generate text embeddings for completed items that have tags but no text
 * vector. For each item, rebuild the embedding from its persisted tags and
 * upsert the vector — no source re-fetch, no vision, no tag re-generation, just
 * one cheap `text-embedding-3-small` call (billed usage recorded).
 *
 * This mirrors the text-embedding half of `enrich-item`, but rebuilds from the
 * item's stored `tags` alone: `sourceText` (OCR/objects/page text) isn't
 * persisted, so the heal is intentionally tags-only — a slightly weaker vector
 * than the original, but strictly better than the none it's replacing. The group
 * only contains items with non-empty tags, so there's always something to embed.
 *
 * With no payload it sweeps the whole backlog (trigger manually from the
 * Trigger.dev dashboard). Passing `itemIds` scopes it to a specific set — how the
 * admin "Missing text vector" reprocess heals its capped batch without touching
 * the paid capture pipeline (see src/lib/admin/reprocess-issues.ts).
 */

import { logger, task } from "@trigger.dev/sdk";
import {
  buildEmbeddingText,
  truncateToTokenLimit,
} from "@/lib/ai/generate-tags-from-content";
import { recordAiUsage } from "@/lib/ai-costs/record-ai-usage";
import db from "@/lib/db";
import { generateTextEmbedding, upsertTextVector } from "@/lib/embeddings";
import { captureServerException } from "@/lib/posthog-server";

const EMBEDDING_TOKEN_LIMIT = 8191;
const TEXT_EMBEDDING_MODEL = "text-embedding-3-small";

export type BackfillTextVectorsPayload = {
  /** Restrict the sweep to these items; omit to backfill every missing vector. */
  itemIds?: string[];
};

export type BackfillTextVectorsResult = {
  total: number;
  updated: number;
  /** Legitimately nothing to embed (guarded — should be ~0). */
  skipped: number;
  /** Rows that errored this pass (a retry re-attempts only these). */
  failed: number;
};

/**
 * Rebuild missing text vectors for completed, tagged items (optionally scoped to
 * `itemIds`). Extracted from the task so the failure handling is unit-testable.
 *
 * Per-item errors (a transient OpenAI/DB blip) are reported and counted, not
 * masked as skips — after the pass, if any failed, we throw so Trigger's
 * configured retries re-run. That's safe because the query is idempotent: rows
 * healed this pass already have a vector and drop out, so a retry only re-attempts
 * the ones still missing one.
 */
export async function backfillTextVectors(
  itemIds?: string[],
): Promise<BackfillTextVectorsResult> {
  // Completed items with embeddable content (non-empty tags) but no text vector
  // — the same predicate as the missing-text-vector issue group.
  const rows = await db.item.findMany({
    where: {
      processingStatus: "completed",
      tags: { isEmpty: false },
      textVectors: { none: {} },
      ...(itemIds?.length ? { id: { in: itemIds } } : {}),
    },
    select: { id: true, userId: true, tags: true },
  });

  logger.info(`Found ${rows.length} items to backfill text vectors`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const text = buildEmbeddingText(row.tags, undefined);
    if (!text) {
      // Guarded by the query, but stay defensive — nothing to embed
      skipped++;
      continue;
    }
    try {
      const input = truncateToTokenLimit(text, EMBEDDING_TOKEN_LIMIT);
      const { embedding, totalTokens } = await generateTextEmbedding(input);

      // Record the billed call before persistence — a DB failure below must
      // not drop the cost of a request already made (mirrors enrich-item).
      recordAiUsage({
        userId: row.userId,
        itemId: row.id,
        provider: "openai",
        operation: "text_embedding",
        model: TEXT_EMBEDDING_MODEL,
        totalTokens,
        source: "ingestion",
      });

      await upsertTextVector({
        itemId: row.id,
        userId: row.userId,
        model: TEXT_EMBEDDING_MODEL,
        embedding,
      });
      updated++;

      if (updated % 100 === 0) {
        logger.info(`Progress: ${updated}/${rows.length} updated`);
      }
    } catch (error) {
      // Transient failure — report + count, don't mask as a skip so the throw
      // below lets Trigger retry the still-missing rows.
      logger.error(`Failed to backfill text vector for ${row.id}`, { error });
      captureServerException(error, row.userId, {
        task: "backfill-text-vectors",
        itemId: row.id,
      });
      failed++;
    }
  }

  logger.info(
    `Text vector backfill: ${updated} updated, ${skipped} skipped, ${failed} failed, ${rows.length} total`,
  );

  // Surface failures so the configured retries re-attempt the rows still missing
  // a vector (the ones healed this pass are already filtered out — idempotent).
  if (failed > 0) {
    throw new Error(
      `Text vector backfill: ${failed} of ${rows.length} items failed`,
    );
  }

  return { total: rows.length, updated, skipped, failed };
}

export const backfillTextVectorsTask = task({
  id: "backfill-text-vectors",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
  },
  run: ({ itemIds }: BackfillTextVectorsPayload = {}) =>
    backfillTextVectors(itemIds),
});
