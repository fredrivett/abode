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

const EMBEDDING_TOKEN_LIMIT = 8191;
const TEXT_EMBEDDING_MODEL = "text-embedding-3-small";

export type EmbedNotePayload = { itemId: string; userId: string };

export type EmbedNoteResult = {
  success: true;
  outcome: "embedded" | "cleared" | "skipped";
};

/**
 * Embed the note as it is now. A note emptied of all text has its old vector
 * removed, so it stops matching what it used to say. Extracted from the task so
 * it's testable outside a run.
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
  if (!text) {
    await db.itemTextVector.deleteMany({
      where: { itemId, model: TEXT_EMBEDDING_MODEL },
    });
    return { success: true, outcome: "cleared" };
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
