import type { AnyTask, TaskIdentifier, TaskPayload } from "@trigger.dev/sdk";
import { tasks } from "@trigger.dev/sdk";
import db from "@/lib/db";
import { itemTag, userTag } from "@/lib/items/run-tags";
import {
  releaseBackgroundSlot,
  reserveBackgroundSlot,
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
  | { status: "deferred" }
  | { status: "skipped" };

/**
 * Enqueue background/bulk item processing, OR defer it when the user's daily
 * allowance for `bucket` is drawn down to the interactive reserve. The single
 * choke point for bulk work that must yield to live user actions — currently the
 * book importer's enrichment.
 *
 * Contrast with {@link enqueueUserProcessing} (live user work): that runs at
 * {@link USER_ACTION_PRIORITY} and is never deferred. This runs at the default
 * background priority `0`. The sequence is:
 *   1. Atomically reserve a background slot ({@link reserveBackgroundSlot}). No
 *      slot → park the item as `deferred` and return; the daily sweep
 *      ({@link resumeDeferredItems}) retries it once headroom returns.
 *   2. Atomically claim the item (`pending`/`deferred` → `processing`). If it's
 *      already being processed (another worker won the race), release the slot
 *      and return `skipped` — never a second paid run for the same item.
 *   3. Trigger the run. If that throws, roll back — restore the item to
 *      `deferred` and release the slot — then rethrow so the caller can report
 *      it; the item is left retryable by the next sweep, not stranded.
 *
 * Reserving before triggering (and releasing on failure) means accepted paid work
 * is always charged to the shared allowance and a failed enqueue never leaks a
 * slot.
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

  const reserved = await reserveBackgroundSlot(userId, bucket);
  if (!reserved) {
    await db.item.update({
      where: { id: itemId, userId },
      data: { processingStatus: "deferred" },
    });
    return { status: "deferred" };
  }

  // Atomically claim the item — only if it isn't already being processed — so two
  // workers can't both enqueue paid work for the same item. markProcessingActive
  // and the reaper key off processing/pending, so this also puts it under their
  // watch once claimed.
  const claim = await db.item.updateMany({
    where: {
      id: itemId,
      userId,
      processingStatus: { in: ["pending", "deferred"] },
    },
    data: { processingStatus: "processing", processingStartedAt: new Date() },
  });
  if (claim.count === 0) {
    await releaseBackgroundSlot(userId, bucket);
    return { status: "skipped" };
  }

  try {
    await tasks.trigger<TTask>(id, payload, {
      concurrencyKey: userId,
      tags: [itemTag(itemId), userTag(userId)],
    });
  } catch (error) {
    // Roll back so the slot isn't leaked and the item isn't stranded as
    // `processing` (which the sweep would never revisit): re-park it as deferred
    // for the next sweep, release the slot, and surface the failure.
    await db.item.updateMany({
      where: { id: itemId, userId, processingStatus: "processing" },
      data: { processingStatus: "deferred" },
    });
    await releaseBackgroundSlot(userId, bucket);
    throw error;
  }

  return { status: "enqueued" };
}
