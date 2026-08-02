import type { AnyTask, TaskIdentifier, TaskPayload } from "@trigger.dev/sdk";
import { tasks } from "@trigger.dev/sdk";

/**
 * Trigger priority for user-initiated item processing on the shared processing
 * queues.
 *
 * Trigger priority is a `createdAt` offset in seconds — a run's dequeue position
 * is `createdAt − priority`, so a *larger* value dequeues *sooner* (as if the
 * run were created earlier). Background work (admin reprocess, backfills) runs
 * at the default priority `0`; giving every user action this large positive
 * offset lets a fresh user-initiated run jump ahead of any queued background run
 * regardless of how long that run has waited, while preserving user-vs-user
 * order (all user runs shift by the same amount). Trade-off: under sustained
 * user traffic, background runs yield on the shared queue until it quiets —
 * intended (users come first; backfills are latency-tolerant).
 *
 * NEVER express "run this behind live work" as a *negative* priority on the
 * background run: a negative offset schedules it into the *future* and strands
 * it in `queued`. Prioritise the foreground instead — that's this constant.
 */
export const USER_ACTION_PRIORITY = 31_536_000; // 1 year, in seconds

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
 */
export function enqueueUserProcessing<TTask extends AnyTask>(
  id: TaskIdentifier<TTask>,
  payload: TaskPayload<TTask>,
  userId: string,
) {
  return tasks.trigger<TTask>(id, payload, {
    concurrencyKey: userId,
    priority: USER_ACTION_PRIORITY,
  });
}
