/**
 * (Re-)embed a note for semantic search from its stored title, body and manual
 * tags. Notes are composed in-app, so they never pass through enrich-item, the
 * step that embeds captured items. Queued (debounced) by `enqueueNoteEmbedding`
 * whenever a note is created or edited.
 */

import { logger, task } from "@trigger.dev/sdk";
import { truncateToTokenLimit } from "@/lib/ai/generate-tags-from-content";
import { recordAiUsage } from "@/lib/ai-costs/record-ai-usage";
import db from "@/lib/db";
import {
  generateTextEmbedding,
  isOpenAiConfigured,
  upsertTextVector,
} from "@/lib/embeddings";
import { buildNoteEmbeddingText } from "@/lib/items/note-embedding";
import { captureServerException } from "@/lib/posthog-server";
import {
  assertSystemDailyBudget,
  assertUserDailyBudget,
  assertUserMonthlyBudget,
  isUsageLimitsEnforced,
} from "@/lib/usage-limits";

const EMBEDDING_TOKEN_LIMIT = 8191;
const TEXT_EMBEDDING_MODEL = "text-embedding-3-small";

export type EmbedNotePayload = { itemId: string; userId: string };

export type EmbedNoteResult = {
  success: true;
  outcome: "embedded" | "cleared" | "skipped" | "over-budget";
};

/**
 * Whether a $ cap (the user's daily or monthly, or the system breaker) is spent
 * and enforced. Note edits aren't a gated action like a capture, so their
 * embeddings check the caps here, at the point they'd spend.
 */
async function isOverBudget(userId: string): Promise<boolean> {
  if (!isUsageLimitsEnforced()) return false;
  const budgets = await Promise.all([
    assertUserDailyBudget(userId),
    assertUserMonthlyBudget(userId),
    assertSystemDailyBudget(),
  ]);
  return budgets.some((budget) => !budget.underBudget);
}

/**
 * Embed the note as it is now. A note emptied of all text, or edited while its
 * owner is over budget, has its old vector removed, so it stops matching what it
 * used to say; the text-vector backfill embeds it later. Extracted from the task
 * so it's testable outside a run.
 */
export async function embedNote({
  itemId,
  userId,
}: EmbedNotePayload): Promise<EmbedNoteResult> {
  if (!isOpenAiConfigured()) {
    logger.info("OpenAI not configured — skipping note embedding", { itemId });
    return { success: true, outcome: "skipped" };
  }

  const note = await db.item.findFirst({
    where: { id: itemId, userId, kind: "note" },
    select: {
      title: true,
      userTags: true,
      noteDetails: { select: { content: true } },
    },
  });
  // Deleted before the debounced run started
  if (!note) return { success: true, outcome: "skipped" };

  const text = buildNoteEmbeddingText({
    title: note.title,
    userTags: note.userTags,
    content: note.noteDetails?.content,
  });
  const clearVector = () =>
    db.itemTextVector.deleteMany({
      where: { itemId, model: TEXT_EMBEDDING_MODEL },
    });
  if (!text) {
    await clearVector();
    return { success: true, outcome: "cleared" };
  }
  if (await isOverBudget(userId)) {
    logger.info("Over budget — not embedding note", { itemId });
    await clearVector();
    return { success: true, outcome: "over-budget" };
  }

  const { embedding, totalTokens } = await generateTextEmbedding(
    truncateToTokenLimit(text, EMBEDDING_TOKEN_LIMIT),
  );
  // Record the billed call before persistence — a DB failure below must not
  // drop the cost of a request already made (mirrors enrich-item)
  recordAiUsage({
    userId,
    itemId,
    provider: "openai",
    operation: "text_embedding",
    model: TEXT_EMBEDDING_MODEL,
    totalTokens,
    source: "ingestion",
  });
  await upsertTextVector({
    itemId,
    userId,
    model: TEXT_EMBEDDING_MODEL,
    embedding,
  });
  return { success: true, outcome: "embedded" };
}

export const embedNoteTask = task({
  id: "embed-note",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
  },
  maxDuration: 60,
  // Queued with the note's id as concurrencyKey, so runs for one note never
  // overlap: a later edit's run starts after the earlier one has written, and
  // reads the latest text
  queue: { concurrencyLimit: 1 },
  run: async (payload: EmbedNotePayload) => {
    try {
      return await embedNote(payload);
    } catch (error) {
      // The note itself is saved and usable, so it isn't marked failed: only
      // its semantic match is missing until a retry (or the text-vector
      // backfill) fills it
      logger.error("Note embedding failed", { itemId: payload.itemId, error });
      captureServerException(error, payload.userId, {
        task: "embed-note",
        itemId: payload.itemId,
      });
      throw error;
    }
  },
});
