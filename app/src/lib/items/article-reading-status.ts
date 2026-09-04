import { ArticleReadingStatus } from "@prisma/client";
import { z } from "zod";

// Client-facing reading states for an article. The DB enum only has `reading`
// and `read`; `unread` is the third, un-tracked state (readingStatus = null in
// the DB). Keeping `unread` explicit at the API boundary lets the client patch
// "mark as unread" as a first-class action rather than sending a raw null.
export const ARTICLE_READING_STATUS_VALUES = [
  "unread",
  "reading",
  "read",
] as const;
export type ArticleReadingStatusValue =
  (typeof ARTICLE_READING_STATUS_VALUES)[number];

// Human-readable labels. Completeness is asserted in the colocated test.
export const ARTICLE_READING_STATUS_LABELS: Record<
  ArticleReadingStatusValue,
  string
> = {
  unread: "Unread",
  reading: "Reading",
  read: "Read",
};

// How long the reader must stay in view (with a scroll having happened) before
// an unread article auto-advances to `reading`. Long enough to require genuine
// reading intent, so a quick open-scroll-close doesn't count.
export const ARTICLE_READING_DWELL_MS = 20_000;

// Fraction of the article that must be scrolled past before the end-of-article
// "mark as read?" nudge appears.
export const ARTICLE_READ_NUDGE_SCROLL_THRESHOLD = 0.95;

// Per-kind (article) reading fields sent in an item PATCH body, grouped under
// `articleReading` so the route can route it straight to the itemArticleDetails
// write. Both fields optional so the client can patch status and scroll
// progress independently.
export const articleReadingSchema = z.object({
  status: z.enum(ARTICLE_READING_STATUS_VALUES).optional(),
  // 0..1 fraction of the article scrolled. Resume position only — never a
  // status signal (a quick scroll doesn't imply `reading`).
  scrollProgress: z.number().min(0).max(1).optional(),
});

export type ArticleReadingPatch = z.infer<typeof articleReadingSchema>;

// The concrete itemArticleDetails columns a reading patch writes. Usable in
// both the upsert `create` and `update` bodies. Only keys that actually change
// are present, so unrelated fields are never touched.
export type ArticleReadingUpdate = {
  readingStatus?: ArticleReadingStatus | null;
  startedAt?: Date | null;
  readAt?: Date | null;
  scrollProgress?: number;
  progressUpdatedAt?: Date;
};

type ArticleReadingCurrent = {
  readingStatus: ArticleReadingStatus | null;
  startedAt: Date | null;
  readAt: Date | null;
} | null;

// Pure translation from a reading patch (+ the current stored row) to the DB
// columns to write. Centralizes the lifecycle rules so they stay in one tested
// place:
//   - `unread` clears status + both timestamps (scrollProgress is kept for
//     resume; the sidebar toggle only resets the read state, not the position).
//   - `reading` stamps startedAt once and never downgrades a `read` article.
//   - `read` stamps readAt once (preserving the original when already read) and
//     backfills startedAt if the article was marked read straight from unread.
//   - scrollProgress always updates (even on a read article) and stamps
//     progressUpdatedAt as a "last read" signal.
export function computeArticleReadingUpdate({
  patch,
  current,
  now = new Date(),
}: {
  patch: ArticleReadingPatch;
  current: ArticleReadingCurrent;
  now?: Date;
}): ArticleReadingUpdate {
  const update: ArticleReadingUpdate = {};

  if (patch.status === "unread") {
    update.readingStatus = null;
    update.startedAt = null;
    update.readAt = null;
  } else if (patch.status === "reading") {
    // Never downgrade a read article back to reading.
    if (current?.readingStatus !== ArticleReadingStatus.read) {
      update.readingStatus = ArticleReadingStatus.reading;
      update.startedAt = current?.startedAt ?? now;
    }
  } else if (patch.status === "read") {
    update.readingStatus = ArticleReadingStatus.read;
    update.readAt = current?.readAt ?? now;
    update.startedAt = current?.startedAt ?? now;
  }

  if (patch.scrollProgress !== undefined) {
    update.scrollProgress = patch.scrollProgress;
    update.progressUpdatedAt = now;
  }

  return update;
}
