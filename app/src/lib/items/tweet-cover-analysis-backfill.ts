import type { Prisma } from "@prisma/client";

/**
 * Prefilter for the cover-analysis backfill: tweets whose images are re-hosted
 * (`coverFileKey` set). Whether the *current* cover still needs analysis is
 * decided per-row by {@link coverNeedsAnalysis} — a tweet may already have a
 * cache row for a *previous* cover, which mustn't exclude it, so we can't filter
 * that here (Prisma relation filters can't correlate on `coverFileKey`).
 */
export function tweetCoverAnalysisBackfillWhere(): Prisma.ItemWhereInput {
  return { kind: "twitter", coverFileKey: { not: null } };
}

/**
 * True when a tweet's current cover has no analysis cache row yet, so the
 * backfill should (re)analyse it. Keyed on the current cover, not on whether any
 * analysis exists, so a stale row for an old cover doesn't skip the tweet.
 */
export function coverNeedsAnalysis(
  coverFileKey: string,
  analysedFileKeys: string[],
): boolean {
  return !analysedFileKeys.includes(coverFileKey);
}
