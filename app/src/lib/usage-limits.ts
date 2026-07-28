/**
 * Durable per-user daily AI usage limits (see plan-user-daily-limits.md).
 *
 * The money control abused in the cost-abuse audit is a per-account daily cap
 * backed by Postgres — the same core datastore the request path already trusts,
 * so an attacker's loop can't outrun it the way it can outrun best-effort
 * PostHog events. Two granularities live in one `usage_daily` row:
 *   - `count`  — incremented once per *user action* at the API route (the hard
 *                gate). Atomic unconditional increment + app-side compare keeps
 *                shadow-mode counts truthful for calibration.
 *   - `costUsd`— incremented per *paid call* at the recordAiUsage seam (the
 *                secondary $ backstop + admin figure).
 *
 * v1 ships in SHADOW MODE: we always count/accrue and log would-be-blocks, but
 * only return 429 once `USAGE_LIMITS_ENFORCED=true`. Tune `DAILY_LIMITS` against
 * real heavy users first, then flip the flag.
 *
 * Trigger.dev safety: this module is imported (via `accrueUsageCost`) by
 * `record-ai-usage.ts`, which runs inside Trigger.dev tasks. Like
 * `posthog-server.ts`, it therefore reads `process.env` directly instead of
 * importing the `server-only` `@/env.server`, which would break those imports.
 */

import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { getPostHogClient } from "@/lib/posthog-server";

const log = createLogger("lib/usage-limits");

/**
 * Per-bucket daily action limits. Starting points — tune against real usage in
 * shadow mode (these are deliberately generous guesses, not measured p99s).
 * Mirrors the shape of `RATE_LIMITS` in rate-limit.ts.
 */
export const DAILY_LIMITS = {
  ingestion: 150, // POST /items + /items/from-url
  reanalysis: 20, // /items/[id]/reassign + /retry (rarely legitimately high)
  location: 150, // /items/[id]/location (Mapbox geocode per call)
  search: 500, // reserved — search route still uses its in-memory cap in v1
  emoji: 180, // reserved — matches today's emojiSuggestDaily cap
} as const;

export type UsageBucket = keyof typeof DAILY_LIMITS;

/** Secondary $ backstop across all buckets for a single user, per UTC day. */
export const PER_USER_DAILY_USD = 2.0;
/** Global circuit-breaker across all users, per UTC day. */
export const SYSTEM_DAILY_USD = 50.0;

/**
 * Whether daily limits actually block (429) vs. shadow-mode (count + log only).
 * Optional, defaults to false — a missing flag is a valid deployment. Read from
 * `process.env` directly for Trigger.dev import safety (see file header).
 */
export function isUsageLimitsEnforced(): boolean {
  return process.env.USAGE_LIMITS_ENFORCED === "true";
}

export type UsageLimitCheck = {
  /** True when this action is within the bucket's daily limit. */
  allowed: boolean;
  /** The user's action count in this bucket today, after this increment. */
  count: number;
  /** The configured limit for this bucket. */
  limit: number;
  /** Seconds until the counter resets (next UTC midnight). */
  retryAfterSeconds: number;
  bucket: UsageBucket;
};

/**
 * Seconds from `now` to the next UTC midnight (when daily counters reset).
 * Always ≥ 1 so a `Retry-After` header is never zero/negative.
 */
export function secondsUntilUtcMidnight(now: Date = new Date()): number {
  const nextMidnight = new Date(now);
  nextMidnight.setUTCHours(24, 0, 0, 0);
  return Math.max(
    1,
    Math.ceil((nextMidnight.getTime() - now.getTime()) / 1000),
  );
}

/**
 * Atomically record one action in `(user, today, bucket)` and report whether
 * it's within the limit.
 *
 * The increment is UNCONDITIONAL — we always +1 and compare in app code — so
 * the stored `count` reflects true demand (including would-be-blocked attempts)
 * for shadow-mode calibration. The single upsert is race-free: concurrent calls
 * each get a distinct post-increment `count`, so exactly the first `limit`
 * callers in a day see `allowed: true`.
 */
export async function assertWithinDailyLimit(
  userId: string,
  bucket: UsageBucket,
): Promise<UsageLimitCheck> {
  const limit = DAILY_LIMITS[bucket];

  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO usage_daily (user_id, day, bucket, count, updated_at)
    VALUES (${userId}::uuid, (now() AT TIME ZONE 'utc')::date, ${bucket}, 1, now())
    ON CONFLICT (user_id, day, bucket)
    DO UPDATE SET count = usage_daily.count + 1, updated_at = now()
    RETURNING count
  `;

  const count = Number(rows[0]?.count ?? 0);

  return {
    allowed: count <= limit,
    count,
    limit,
    retryAfterSeconds: secondsUntilUtcMidnight(),
    bucket,
  };
}

/** What the guard decided to do about an over-limit action. */
export type GuardAction = "allow" | "block" | "shadow";

/**
 * Pure decision: given whether the action is within limit and whether
 * enforcement is on, what should happen. Kept separate from the DB/side-effects
 * so it's trivially unit-testable.
 */
export function resolveGuardAction(
  allowed: boolean,
  enforced: boolean,
): GuardAction {
  if (allowed) return "allow";
  return enforced ? "block" : "shadow";
}

export type UsageGuardResult = {
  /** True → proceed. False → the route should return 429. */
  ok: boolean;
  action: GuardAction;
  check: UsageLimitCheck;
};

/**
 * Route-facing guard: always counts the action, then applies the shadow-vs-
 * enforce policy. When over limit and enforced, returns `ok: false` (the route
 * turns that into a 429). When over limit and NOT enforced, returns `ok: true`
 * but logs + emits a `usage_limit_would_block` PostHog event for calibration.
 */
export async function guardDailyLimit(
  userId: string,
  bucket: UsageBucket,
): Promise<UsageGuardResult> {
  const check = await assertWithinDailyLimit(userId, bucket);
  const action = resolveGuardAction(check.allowed, isUsageLimitsEnforced());

  if (action === "block") {
    log.warn(
      { userId, bucket, count: check.count, limit: check.limit },
      "Daily usage limit reached — blocking (enforced)",
    );
    return { ok: false, action, check };
  }

  if (action === "shadow") {
    log.warn(
      { userId, bucket, count: check.count, limit: check.limit },
      "Daily usage limit would block (shadow mode — not enforced)",
    );
    getPostHogClient()?.capture({
      distinctId: userId,
      event: "usage_limit_would_block",
      properties: {
        userId,
        bucket,
        count: check.count,
        limit: check.limit,
      },
    });
  }

  return { ok: true, action, check };
}

/**
 * Accrue downstream paid $ onto `(user, today, bucket)`. Upserts the row if the
 * count gate hasn't created it yet (count stays 0 so cost can't fabricate a
 * count). Best-effort — like the PostHog capture it must NEVER throw to its
 * caller, since the count gate is the hard control.
 */
export async function accrueUsageCost(
  userId: string,
  bucket: UsageBucket,
  costUsd: number,
): Promise<void> {
  if (!Number.isFinite(costUsd) || costUsd <= 0) return;

  try {
    await db.$executeRaw`
      INSERT INTO usage_daily (user_id, day, bucket, count, cost_usd, updated_at)
      VALUES (${userId}::uuid, (now() AT TIME ZONE 'utc')::date, ${bucket}, 0, ${costUsd}::numeric, now())
      ON CONFLICT (user_id, day, bucket)
      DO UPDATE SET cost_usd = usage_daily.cost_usd + ${costUsd}::numeric, updated_at = now()
    `;
  } catch (error) {
    // Weakening the secondary $ backstop is acceptable; failing the caller isn't.
    log.warn({ error, userId, bucket }, "Failed to accrue usage cost");
  }
}

export type UserDailyBudget = {
  /** True while today's summed spend is below `PER_USER_DAILY_USD`. */
  underBudget: boolean;
  spentUsd: number;
  limitUsd: number;
};

/**
 * Secondary backstop: sum today's `cost_usd` across all buckets for a user and
 * report whether they're under the per-user daily $ cap. Cache-free (≤ a few
 * rows per user per day).
 */
export async function assertUserDailyBudget(
  userId: string,
): Promise<UserDailyBudget> {
  const rows = await db.$queryRaw<{ sum: string }[]>`
    SELECT COALESCE(SUM(cost_usd), 0)::text AS sum
    FROM usage_daily
    WHERE user_id = ${userId}::uuid
      AND day = (now() AT TIME ZONE 'utc')::date
  `;

  const spentUsd = Number(rows[0]?.sum ?? "0");

  return {
    underBudget: spentUsd < PER_USER_DAILY_USD,
    spentUsd,
    limitUsd: PER_USER_DAILY_USD,
  };
}
