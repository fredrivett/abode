import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

/**
 * Staggered grid reveal timing.
 *
 * Each item fades in slightly after the one before it, so a grid never appears
 * all at once. The cascade resets every page-batch: infinite-scroll pages mount
 * together, and without a reset every item past the cap would share one delay
 * and pop simultaneously. Resetting per batch means each new page cascades from
 * the start instead.
 */

// Seconds between consecutive items
export const REVEAL_STAGGER_STEP = 0.035;

// Cap on how many steps contribute to the delay, so the tail of a batch never
// waits an uncomfortably long time before appearing
export const REVEAL_MAX_STEPS = 14;

// The cascade resets at each page boundary (matches the pagination page size)
export const REVEAL_BATCH_SIZE = DEFAULT_PAGE_SIZE;

/** Reveal delay (seconds) for the item at `index` within the full list. */
export function getRevealDelay(index: number): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  const positionInBatch = Math.floor(index) % REVEAL_BATCH_SIZE;
  const steps = Math.min(positionInBatch, REVEAL_MAX_STEPS);
  return steps * REVEAL_STAGGER_STEP;
}
