import type { Prisma } from "@prisma/client";

/**
 * Tweets eligible for the cover-analysis backfill: tweets whose images are
 * already re-hosted (`coverFileKey` set) but that have no per-image analysis yet
 * (`item_media_analysis` empty). Runs after the re-hosting backfill.
 *
 * `mediaAnalyses: { none: {} }` makes it idempotent — once a tweet's cover is
 * analysed it has a cache row and drops out, so the backfill is safe to re-run.
 */
export function tweetCoverAnalysisBackfillWhere(): Prisma.ItemWhereInput {
  return {
    kind: "twitter",
    coverFileKey: { not: null },
    mediaAnalyses: { none: {} },
  };
}
