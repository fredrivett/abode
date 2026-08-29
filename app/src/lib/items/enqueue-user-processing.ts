import type { AnyTask, TaskIdentifier, TaskPayload } from "@trigger.dev/sdk";
import { tasks } from "@trigger.dev/sdk";
import { itemTag, userTag } from "@/lib/items/run-tags";

/** Narrow a task payload to those carrying an `itemId` (all item pipelines do). */
function hasItemId(payload: unknown): payload is { itemId: string } {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "itemId" in payload &&
    typeof payload.itemId === "string"
  );
}

/**
 * Trigger priority for user-initiated item processing on the shared processing
 * queues.
 *
 * Trigger priority is a `createdAt` offset in seconds — a run's dequeue position
 * is `createdAt − priority`, so a *larger* value dequeues *sooner* (as if the
 * run were created earlier). Background work (admin reprocess, backfills) runs
 * at the default priority `0`; giving every user action this positive offset
 * lets a fresh user-initiated run jump ahead of any background run that has
 * waited up to `USER_ACTION_PRIORITY` seconds, while preserving user-vs-user
 * order (all user runs shift by the same amount). Trade-off: under sustained
 * user traffic, background runs yield on the shared queue until it quiets —
 * intended (users come first; backfills are latency-tolerant).
 *
 * Keep this comfortably below {@link MAX_SAFE_PRIORITY}. Trigger.dev's API
 * rejects an over-large priority (the server overflows on `priority × 1000`
 * ms), throwing `TriggerApiError` from `tasks.trigger`. A prior value of one
 * *year* (31_536_000) tripped this and silently broke *every* user-initiated
 * enqueue — no run was created, items were marked failed at save. One day is
 * more than enough to clear any realistic background backlog.
 *
 * NEVER express "run this behind live work" as a *negative* priority on the
 * background run: a negative offset schedules it into the *future* and strands
 * it in `queued`. Prioritise the foreground instead — that's this constant.
 */
export const USER_ACTION_PRIORITY = 86_400; // 1 day, in seconds

/**
 * Upper bound for a Trigger priority we'll send. `priority × 1000` (the server's
 * ms conversion) must stay within a signed 32-bit int, so priority ≤ ~2.147M
 * seconds (~24.8 days). We guard well under it. Enforced by a unit test.
 */
export const MAX_SAFE_PRIORITY = 2_000_000;

/**
 * The single choke point for enqueueing user-initiated item processing
 * (`classify-url` / `analyze-image`). Bakes in the two options every user run
 * must carry: a per-user `concurrencyKey` (fair scheduling across owners on the
 * shared queues) and {@link USER_ACTION_PRIORITY} so live runs dequeue ahead of
 * admin/backfill background work.
 *
 * User-facing code MUST enqueue through here, never `tasks.trigger` directly —
 * that's what makes the priority impossible to forget (enforced by the
 * `no-raw-user-processing` Biome rule). Background work (admin reprocess,
 * backfills) intentionally does NOT use this: it triggers directly and runs at
 * the default priority 0.
 *
 * Also stamps `item_<id>` + `user_<id>` run tags (see run-tags.ts) so every
 * user run is filterable back to its item/owner in the Trigger dashboard —
 * centralised here so no user path can ship an untagged run.
 */
export function enqueueUserProcessing<TTask extends AnyTask>(
  id: TaskIdentifier<TTask>,
  payload: TaskPayload<TTask>,
  userId: string,
) {
  const tags = hasItemId(payload)
    ? [itemTag(payload.itemId), userTag(userId)]
    : [userTag(userId)];
  return tasks.trigger<TTask>(id, payload, {
    concurrencyKey: userId,
    priority: USER_ACTION_PRIORITY,
    tags,
  });
}
