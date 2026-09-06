import { z } from "zod";

// Per-kind (article) read fields sent in an item PATCH body, grouped under
// `articleReading` so the route can route it straight to the itemArticleDetails
// write. Both fields optional so the client can patch read status and scroll
// progress independently.
export const articleReadingSchema = z.object({
  read: z.boolean().optional(),
  // 0..1 fraction of the article scrolled, for resume.
  scrollProgress: z.number().min(0).max(1).optional(),
});

export type ArticleReadingPatch = z.infer<typeof articleReadingSchema>;

// The concrete itemArticleDetails columns a reading patch writes. Usable in
// both the upsert `create` and `update` bodies. Only keys that actually change
// are present, so unrelated fields are never touched.
export type ArticleReadingUpdate = {
  readAt?: Date | null;
  scrollProgress?: number;
  progressUpdatedAt?: Date;
};

// Pure translation from a reading patch (+ the current stored row) to the DB
// columns to write. Centralizes the rules so they stay in one tested place:
//   - read: true stamps readAt once, preserving the original timestamp when the
//     article was already read (re-confirming doesn't reset "read on" date).
//   - read: false clears readAt back to unread (scrollProgress is kept for
//     resume — the toggle only resets read state, not the position).
//   - scrollProgress always updates (even on a read article) and stamps
//     progressUpdatedAt as a "last read" signal.
export function computeArticleReadingUpdate({
  patch,
  current,
  now = new Date(),
}: {
  patch: ArticleReadingPatch;
  current: { readAt: Date | null } | null;
  now?: Date;
}): ArticleReadingUpdate {
  const update: ArticleReadingUpdate = {};

  if (patch.read === true) {
    update.readAt = current?.readAt ?? now;
  } else if (patch.read === false) {
    update.readAt = null;
  }

  if (patch.scrollProgress !== undefined) {
    update.scrollProgress = patch.scrollProgress;
    update.progressUpdatedAt = now;
  }

  return update;
}
