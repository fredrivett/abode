/**
 * Trigger priority for user-initiated captures on the shared capture queues.
 *
 * Trigger priority is a `createdAt` offset in seconds — a run's dequeue position
 * is `createdAt − priority`, so a *larger* value dequeues *sooner* (as if the
 * run were created earlier). Background work (admin reprocess, backfills) runs
 * at the default priority `0`; giving every user action this large positive
 * offset lets a fresh user capture jump ahead of any queued background run
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
