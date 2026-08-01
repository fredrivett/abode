import db from "@/lib/db";

/** Default age past which a non-terminal item is considered stuck (2 hours). */
export const STUCK_ITEM_THRESHOLD_MS = 2 * 60 * 60 * 1000;

/**
 * Sweep items stranded in a non-terminal status (`processing`/`pending`) past
 * the staleness cutoff and mark them `failed` with reason `stalled`.
 *
 * This is the backstop for the one failure mode a task's own try/catch can't
 * reach: the run dying *after* enqueue (OOM, `maxDuration` timeout, a dropped
 * run) leaves the item non-terminal with no error written. The reaper detects
 * that by symptom — no terminal write within the window — so the reason is
 * `stalled` (we know it stopped progressing, not *why*), and it's retryable.
 *
 * A live run keeps bumping `updatedAt` as it writes progress, so it resets its
 * own staleness clock; only a genuinely dead run goes the full window silent.
 * The conditional `updateMany` is atomic, so a run that completes concurrently
 * (flipping to `completed`) simply won't match.
 *
 * @param olderThan - Items whose `updatedAt` is before this are swept.
 * @returns How many items were marked failed.
 */
export async function reapStuckItems({
  olderThan,
}: {
  olderThan: Date;
}): Promise<{ reaped: number }> {
  const { count } = await db.item.updateMany({
    where: {
      processingStatus: { in: ["processing", "pending"] },
      updatedAt: { lt: olderThan },
    },
    data: { processingStatus: "failed", processingError: "stalled" },
  });

  return { reaped: count };
}
