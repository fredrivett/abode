/**
 * Client-safe constants for the durable daily usage limiter.
 *
 * Kept separate from `usage-limits.ts` (which imports `@/lib/db` and is
 * server-only) so the browser can identify a daily-limit 429 without pulling in
 * server code. Both the API routes and the client error helper import from here.
 */

/**
 * Machine-readable `code` on a 429 body when a durable daily action cap blocks a
 * request. Lets the client tell this apart from other 429s (per-minute rate
 * limits, the once-per-item-per-day reassign cap) that share the status.
 */
export const DAILY_LIMIT_REACHED_CODE = "daily_limit_reached";

/** User-facing copy for a blocked-by-daily-limit action. */
export const DAILY_LIMIT_REACHED_MESSAGE =
  "You've reached your daily limit. Please try again tomorrow.";
