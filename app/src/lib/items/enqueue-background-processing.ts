import type { AnyTask, TaskIdentifier, TaskPayload } from "@trigger.dev/sdk";
import { tasks } from "@trigger.dev/sdk";
import db from "@/lib/db";
import { itemTag, userTag } from "@/lib/items/run-tags";
import {
  checkBackgroundBudget,
  incrementDailyCount,
  type UsageBucket,
} from "@/lib/usage-limits";

/** Narrow a task payload to those carrying an `itemId` (all item pipelines do). */
function hasItemId(payload: unknown): payload is { itemId: string } {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "itemId" in payload &&
    typeof payload.itemId === "string"
  );
}

export type BackgroundEnqueueResult =
  | { status: "enqueued" }
  | { status: "deferred" };

/**
 * Enqueue background/bulk item processing, OR defer it when the user's daily
 * allowance for `bucket` is drawn down to the interactive reserve (see
 * {@link checkBackgroundBudget}). The single choke point for bulk work that must
 * yield to live user actions — currently the book importer's enrichment.
 *
 * Contrast with {@link enqueueUserProcessing} (live user work): that runs at
 * {@link USER_ACTION_PRIORITY} and is never deferred. This runs at the default
 * background priority `0`, and:
 *   - defer decision → parks the item as `processingStatus = 'deferred'` and does
 *     NOT enqueue or draw down the daily count; the daily deferred-items sweep
 *     ({@link resumeDeferredItems}) picks it up once headroom returns.
 *   - enqueue decision → flips the item to `processing`, triggers the run, and
 *     draws down the shared daily count so background + interactive share the
 *     same allowance.
 *
 * The count check and increment are not one atomic step, so under concurrent
 * bulk enqueues the reserve boundary can be crossed by a few — acceptable, since
 * the reserve is soft headroom, not a hard cap (the interactive gate,
 * {@link assertWithinDailyLimit}, stays atomic).
 *
 * Enqueue failure (Trigger.dev unconfigured/unreachable) propagates — the caller
 * marks the item failed (the reaper is the backstop for a run that dies later).
 *
 * TODO: existing background backfills (reprocess-images, backfill-tweet-*) still
 * trigger directly at priority 0 without this reserve/defer path. They can opt in
 * here if they ever need to yield the interactive headroom.
 */
export async function enqueueBackgroundProcessing<TTask extends AnyTask>({
  id,
  payload,
  userId,
  bucket,
}: {
  id: TaskIdentifier<TTask>;
  payload: TaskPayload<TTask>;
  userId: string;
  bucket: UsageBucket;
}): Promise<BackgroundEnqueueResult> {
  if (!hasItemId(payload)) {
    throw new Error(
      "enqueueBackgroundProcessing requires a payload with an itemId",
    );
  }
  const { itemId } = payload;

  const decision = await checkBackgroundBudget({ userId, bucket });

  if (!decision.allow) {
    await db.item.update({
      where: { id: itemId, userId },
      data: { processingStatus: "deferred" },
    });
    return { status: "deferred" };
  }

  // Claim the item as processing before enqueuing so the pipeline's
  // markProcessingActive/reaper (which key off processing/pending) cover it.
  await db.item.update({
    where: { id: itemId, userId },
    data: { processingStatus: "processing", processingStartedAt: new Date() },
  });

  await tasks.trigger<TTask>(id, payload, {
    concurrencyKey: userId,
    tags: [itemTag(itemId), userTag(userId)],
  });

  // Draw down the shared daily allowance only for work actually enqueued, so a
  // deferred attempt never inflates the counter.
  await incrementDailyCount(userId, bucket);

  return { status: "enqueued" };
}
