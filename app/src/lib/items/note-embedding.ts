import type { embedNoteTask } from "@app/trigger/embed-note";
import type { Prisma } from "@prisma/client";
import { tasks } from "@trigger.dev/sdk";
import { buildEmbeddingText } from "@/lib/ai/generate-tags-from-content";
import { isOpenAiConfigured } from "@/lib/embeddings";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";

const log = createLogger("lib/items/note-embedding");

/**
 * Notes with something to embed. Notes have no auto tags, so the tag check that
 * proves other items had embeddable text doesn't cover them.
 */
export const NOTE_WITH_TEXT: Prisma.ItemWhereInput = {
  kind: "note",
  OR: [
    { title: { not: "" } },
    { userTags: { isEmpty: false } },
    { noteDetails: { is: { content: { not: "" } } } },
  ],
};

/**
 * The text a note's semantic-search vector is built from: its manual tags, then
 * its title and body. All of it is stored, so re-embedding after an edit loses
 * nothing (unlike captured items, whose source text isn't kept).
 */
export function buildNoteEmbeddingText(note: {
  title: string | null;
  userTags: string[];
  content: string | null | undefined;
}): string | null {
  const text = [note.title?.trim(), note.content?.trim()]
    .filter(Boolean)
    .join("\n\n");
  return buildEmbeddingText(note.userTags, text || undefined);
}

/**
 * Queue a (re-)embedding of a note after it's created or its title, body or
 * tags change. Debounced per note, so a burst of autosaves embeds once, and the
 * task reads the note when it runs, so it always embeds the latest text. The
 * task checks the $ caps before it spends.
 *
 * Semantic search needs OpenAI: without it, skip without queueing anything. A
 * queueing failure is reported but never fails the save.
 */
export async function enqueueNoteEmbedding({
  itemId,
  userId,
}: {
  itemId: string;
  userId: string;
}): Promise<void> {
  if (!isOpenAiConfigured()) {
    log.info({ itemId }, "OpenAI not configured — skipping note embedding");
    return;
  }
  try {
    await tasks.trigger<typeof embedNoteTask>(
      "embed-note",
      { itemId, userId },
      {
        debounce: { key: itemId, delay: "10s", maxDelay: "2m" },
        // One run per note at a time (the task's queue limit is 1 per key)
        concurrencyKey: itemId,
      },
    );
  } catch (error) {
    log.warn({ error, itemId }, "Failed to enqueue note embedding");
    captureServerException(error, userId, { task: "embed-note", itemId });
  }
}
