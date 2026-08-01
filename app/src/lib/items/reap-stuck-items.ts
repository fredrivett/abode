import db from "@/lib/db";

/**
 * Age past which a non-terminal item is considered stuck (4 hours).
 *
 * MUST stay greater than the project `ttl` + the longest task `maxDuration`
 * (both in trigger.config.ts). That guarantees any run associated with an item
 * we reap is already dead — it either finished, was force-stopped at
 * maxDuration, or was dropped from the queue at its TTL — so it can't resume and
 * clobber a retry the user starts after we mark this item failed. Currently
 * 2h ttl + 10m maxDuration = 2h10m < 4h. ✓
 */
export const STUCK_ITEM_THRESHOLD_MS = 4 * 60 * 60 * 1000;

/**
 * Sweep items stranded in a non-terminal status (`processing`/`pending`) past
 * the staleness cutoff and mark them `failed` with reason `stalled`.
 *
 * This is the backstop for the one failure mode a task's own try/catch can't
 * reach: the run dying *after* enqueue (OOM, `maxDuration` timeout, a dropped
 * run) leaves the item non-terminal with no error written. The reaper detects
 * that by symptom — still non-terminal long after processing began — so the
 * reason is `stalled` (we know it stopped progressing, not *why*), and it's
 * retryable.
 *
 * Staleness is measured from `processingStartedAt` (set on each transition into
 * processing/pending), NOT `updatedAt` — an unrelated user edit bumps
 * `updatedAt` and would reset the clock, letting a dead run stay non-terminal.
 * No running heartbeat is needed: a run's lifespan is bounded to the project TTL
 * + maxDuration (see {@link STUCK_ITEM_THRESHOLD_MS}), so anything still
 * non-terminal past the threshold has a definitively-dead run. The conditional
 * `updateMany` is atomic, so a run that completes concurrently won't match.
 *
 * @param olderThan - Items whose `processingStartedAt` is before this are swept.
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
      processingStartedAt: { lt: olderThan },
    },
    data: { processingStatus: "failed", processingError: "stalled" },
  });

  return { reaped: count };
}
