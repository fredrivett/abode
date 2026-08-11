import { createHash } from "node:crypto";

/**
 * Deterministic idempotency key for a batch heal: `<prefix>:<sha256 of the
 * sorted item ids>`.
 *
 * Content-addressed, so a re-click of the same still-unhealed batch produces the
 * same key and dedupes within the trigger TTL, while a batch with different
 * membership (e.g. after some rows are repaired, or a different group) gets a
 * fresh key and runs. Sorted so ordering can't change the key; hashed so it
 * stays bounded regardless of batch size (a raw join of 50 UUIDs is ~1.8 KB).
 *
 * This isn't matched anywhere else — Trigger.dev dedupes by comparing this
 * string across enqueue attempts, nothing recomputes it. Shared across the
 * per-field reprocess heal groups (blur today; visual/text vectors to come).
 */
export function batchIdempotencyKey(prefix: string, itemIds: string[]): string {
  const digest = createHash("sha256")
    .update([...itemIds].sort().join(","))
    .digest("hex");
  return `${prefix}:${digest}`;
}
