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

/** A cover's analysis cache row, as far as backfill selection cares. */
export type AnalysedCover = { fileKey: string; embeddingModel: string | null };

/**
 * True when a tweet's current cover should be (re)analysed by the backfill.
 * Keyed on the current cover, not on whether any analysis exists, so a stale row
 * for an old cover doesn't skip the tweet.
 *
 * A row that exists but has no visual embedding (e.g. a throttled Replicate call
 * dropped it) is re-selected so a re-run can heal it — but only when Replicate
 * is configured, since without it a null embedding is the final state and
 * re-selecting would spin forever.
 */
export function coverNeedsAnalysis(
  coverFileKey: string,
  analysed: AnalysedCover[],
  replicateConfigured: boolean,
): boolean {
  const row = analysed.find((a) => a.fileKey === coverFileKey);
  if (!row) return true;
  return replicateConfigured && row.embeddingModel === null;
}
