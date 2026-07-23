import { write } from "@/lib/db";
import { isBlankNote } from "./note-title";

/**
 * Server-side persistence for the inline note composer's in-progress draft.
 *
 * One draft per user (a singleton keyed by `userId`). This is ephemeral compose
 * text — it never becomes an Item until the user saves — so it lives in its own
 * table and never touches the grid, search, rooms, or public profile.
 */

/**
 * Returns the user's saved draft markdown, or null when there's none.
 *
 * Reads from the primary (not the read replica): the draft is fetched during
 * dashboard SSR immediately after an autosave, so replica lag would render a
 * stale/empty draft and briefly lose the latest keystrokes — the opposite of
 * what this feature promises.
 */
export async function getNoteDraft(userId: string): Promise<string | null> {
  const draft = await write.noteDraft.findUnique({ where: { userId } });
  if (!draft || isBlankNote(draft.content)) return null;
  return draft.content;
}

/**
 * Upserts the user's draft, or clears it when the note is blank so an emptied
 * composer never leaves a stale row behind.
 */
export async function saveNoteDraft(
  userId: string,
  content: string,
): Promise<void> {
  if (isBlankNote(content)) {
    await clearNoteDraft(userId);
    return;
  }
  await write.noteDraft.upsert({
    where: { userId },
    create: { userId, content },
    update: { content },
  });
}

/** Removes the user's draft. A no-op (not an error) when there's none. */
export async function clearNoteDraft(userId: string): Promise<void> {
  await write.noteDraft.deleteMany({ where: { userId } });
}
