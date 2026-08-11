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

const EMBEDDING_TOKEN_LIMIT = 8191;
const TEXT_EMBEDDING_MODEL = "text-embedding-3-small";

export type BackfillTextVectorsPayload = {
  /** Restrict the sweep to these items; omit to backfill every missing vector. */
  itemIds?: string[];
};

export const backfillTextVectorsTask = task({
  id: "backfill-text-vectors",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
  },
  run: async ({ itemIds }: BackfillTextVectorsPayload = {}) => {
    // Completed items with embeddable content (non-empty tags) but no text
    // vector — the same predicate as the missing-text-vector issue group. An
    // optional itemIds narrows the sweep to a specific batch.
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
        logger.error(`Failed to backfill text vector for ${row.id}`, { error });
        skipped++;
      }
    }

    logger.info(
      `Text vector backfill complete: ${updated} updated, ${skipped} skipped, ${rows.length} total`,
    );

    return { total: rows.length, updated, skipped };
  },
});
