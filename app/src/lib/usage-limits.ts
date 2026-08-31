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
 * Enforcement is secure-by-default: we always count/accrue and log would-be-
 * blocks, and return 429s on any built/deployed env (`NODE_ENV=production` —
 * production, preview, staging) unless `USAGE_LIMITS_ENFORCED` is set explicitly
 * ("true" forces enforce, "false" opts out). Local dev + tests stay shadow. See
 * `isUsageLimitsEnforced()`.
 *
 * Trigger.dev safety: this module is imported (via `accrueUsageCost`) by
 * `record-ai-usage.ts`, which runs inside Trigger.dev tasks. Like
 * `posthog-server.ts`, it therefore reads `process.env` directly instead of
 * importing the `server-only` `@/env.server`, which would break those imports.
 */

import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";

const log = createLogger("lib/usage-limits");

/**
 * Per-bucket daily action limits. Mirrors the shape of `RATE_LIMITS` in
 * rate-limit.ts.
 *
 * Calibrated 2026-08-30 against the shadow-mode window: observed real usage sits
 * well below every cap and no bucket has produced a would-be-block, so the
 * original values are kept — each cap bounds a runaway abuse loop while leaving
 * generous headroom for legit power users. The tighter money control is
 * `PER_USER_DAILY_USD` ($2/day), which bites well before 150 paid ingestions.
 */
export const DAILY_LIMITS = {
  // POST /items + /items/from-url. Comfortably above real use; each item is
  // several paid AI calls, so the $2/day cost cap gates money before this count.
  ingestion: 150,
  // /items/[id]/reassign + /retry. reassign is also capped once-per-item-per-day,
  // so 20 distinct items reanalysed/day is already ample headroom.
  reanalysis: 20,
  // /items/[id]/location (Mapbox geocode per call). Geocode is cheap; mirrors
  // ingestion as a coarse abuse bound.
  location: 150,
  search: 500, // reserved — search route still uses its in-memory cap in v1
  emoji: 180, // reserved — matches today's emojiSuggestDaily cap
} as const;

export type UsageBucket = keyof typeof DAILY_LIMITS;

/**
 * Compiled-in defaults for the $ backstops. All three are env-overridable (see
 * the `*UsdLimit()` getters) so an operator sets their own real values without a
 * deploy — a self-hoster gets sane protection out of the box, and our production
 * caps live in env, never in this (public) repo. Treat these as safe placeholders,
 * not the production figures.
 */
/** Per-user daily $ cap across all buckets (the spike limiter). */
export const PER_USER_DAILY_USD = 2.0;
/** Per-user monthly $ cap across all buckets (the binding economic ceiling). */
export const PER_USER_MONTHLY_USD = 5.0;
/** Global daily circuit-breaker across all users (the blast-radius stop). */
export const SYSTEM_DAILY_USD = 10.0;

/**
 * Parse a positive, finite $ override from an env value, else fall back to the
 * compiled default. A blank/garbage/≤0 value degrades to the default rather than
 * silently disabling the cap.
 */
function readUsdOverride(
  envValue: string | undefined,
  fallback: number,
): number {
  if (envValue === undefined || envValue === "") return fallback;
  const parsed = Number(envValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Effective per-user daily $ cap. Env-overridable (`PER_USER_DAILY_USD`) so prod
 * can raise it without a deploy. Read from `process.env` directly for Trigger.dev
 * import safety (see file header).
 */
export function perUserDailyUsdLimit(): number {
  return readUsdOverride(process.env.PER_USER_DAILY_USD, PER_USER_DAILY_USD);
}

/**
 * Effective per-user monthly $ cap — the binding economic ceiling. Env-overridable
 * (`PER_USER_MONTHLY_USD`) so prod can raise it without a deploy.
 */
export function perUserMonthlyUsdLimit(): number {
  return readUsdOverride(
    process.env.PER_USER_MONTHLY_USD,
    PER_USER_MONTHLY_USD,
  );
}

/**
 * Effective system-wide daily $ circuit-breaker. Env-overridable
 * (`SYSTEM_DAILY_USD`) so prod can raise it without a deploy.
 */
export function systemDailyUsdLimit(): number {
  return readUsdOverride(process.env.SYSTEM_DAILY_USD, SYSTEM_DAILY_USD);
}

/**
 * Whether daily limits actually block (429) vs. shadow-mode (count + log only).
 *
 * Secure-by-default: an explicit `USAGE_LIMITS_ENFORCED` always wins ("true"
 * enforces, "false" opts out anywhere), but when it's UNSET we enforce on any
 * built/deployed environment (`NODE_ENV=production` — production, Vercel preview,
 * self-hosted staging) and stay in shadow only for local dev + tests. This means
 * a deployed instance is protected without configuration, and a would-be-costly
 * preview/staging can't silently run uncapped; disabling is a deliberate
 * `=false`. Read from `process.env` directly for Trigger.dev import safety (see
 * file header).
 */
export function isUsageLimitsEnforced(): boolean {
  const flag = process.env.USAGE_LIMITS_ENFORCED;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV === "production";
}

/**
 * Pure decision: should we emit the "not enforced" warning now? True only the
 * first time we're in shadow mode. Separated from the side effect so the
 * once-in-shadow-only logic is trivially unit-testable.
 */
export function shouldWarnShadowMode(
  alreadyWarned: boolean,
  enforced: boolean,
): boolean {
  return !alreadyWarned && !enforced;
}

let hasWarnedShadowMode = false;

/**
 * Log ONCE per process when usage limits are computed but not enforced, so a
 * self-hoster isn't silently unprotected — the caps default to safe values and
 * the app boots without any of these keys (graceful degradation), so the missing
 * piece is deliberate enforcement, not configuration. Informational only; never
 * throws. `USAGE_LIMITS_ENFORCED` being off is a valid deployment.
 */
function warnIfLimitsNotEnforced(): void {
  if (!shouldWarnShadowMode(hasWarnedShadowMode, isUsageLimitsEnforced())) {
    return;
  }
  hasWarnedShadowMode = true;
  log.warn(
    "Usage limits are in SHADOW mode: actions are counted and logged but NEVER blocked. Set USAGE_LIMITS_ENFORCED=true to enforce the per-user/system $ caps (tune via PER_USER_DAILY_USD / PER_USER_MONTHLY_USD / SYSTEM_DAILY_USD, else safe defaults apply).",
  );
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
 * Seconds from `now` to the start of the next UTC month (when the per-user
 * monthly $ cap resets). Drives an honest `Retry-After` for a monthly block —
 * "try next month", not "try tomorrow". Always ≥ 1.
 */
export function secondsUntilUtcMonthStart(now: Date = new Date()): number {
  const nextMonthStart = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1, // rolls over to January of next year at month 12
    1,
    0,
    0,
    0,
    0,
  );
  return Math.max(1, Math.ceil((nextMonthStart - now.getTime()) / 1000));
}

/**
 * Start of the current UTC day (00:00:00.000Z), the boundary for
 * once-per-UTC-day gates so their window resets at the same midnight the daily
 * counters do.
 */
export function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
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

/** Which gate drove a block/shadow decision. Undefined when the action allowed. */
export type GuardReason =
  | "count"
  | "system_budget"
  | "user_daily_budget"
  | "user_monthly_budget";

export type UsageGuardResult = {
  /** True → proceed. False → the route should return 429. */
  ok: boolean;
  action: GuardAction;
  check: UsageLimitCheck;
  /** Which gate blocked/would-block. Undefined when `action === "allow"`. */
  reason?: GuardReason;
};

/**
 * Best-effort PostHog capture that never throws — a throwing/unavailable client
 * must NOT turn a would-allow request into a 500.
 */
function emitUsagePostHog(
  event: string,
  distinctId: string,
  properties: Record<string, unknown>,
): void {
  try {
    getPostHogClient()?.capture({ distinctId, event, properties });
  } catch (error) {
    log.warn({ error, event }, "Failed to emit usage-limit PostHog event");
  }
}

/**
 * The $ backstops are a *secondary* control: the per-bucket count gate (already
 * applied + incremented before these run) is the hard limit. A budget query that
 * throws must not 500 the request path, so we FAIL OPEN (log + treat as
 * under-budget). The catastrophe surface this leaves — an attacker who could
 * sustain budget-query errors — is far narrower than the count/per-bucket gates
 * it would still have to beat, so open is the deliberate choice here.
 */
async function safeSystemBudget(): Promise<SystemDailyBudget | null> {
  try {
    return await assertSystemDailyBudget();
  } catch (error) {
    log.warn({ error }, "System daily budget check failed — failing open");
    return null;
  }
}

async function safeUserDailyBudget(
  userId: string,
): Promise<UserDailyBudget | null> {
  try {
    return await assertUserDailyBudget(userId);
  } catch (error) {
    log.warn(
      { error, userId },
      "Per-user daily budget check failed — failing open",
    );
    return null;
  }
}

async function safeUserMonthlyBudget(
  userId: string,
): Promise<UserMonthlyBudget | null> {
  try {
    return await assertUserMonthlyBudget(userId);
  } catch (error) {
    log.warn(
      { error, userId },
      "Per-user monthly budget check failed — failing open",
    );
    return null;
  }
}

/**
 * Route-facing guard. Always counts the action, then applies four gates in
 * severity order under the shared shadow-vs-enforce policy:
 *   1. per-bucket action count (the hard control),
 *   2. system-wide $ circuit-breaker (caps global blast radius),
 *   3. per-user monthly $ cap (the binding economic ceiling), and
 *   4. per-user daily $ cap (the spike limiter).
 * When any gate trips and enforcement is on, returns `ok: false` (the route
 * turns that into a 429). In shadow mode nothing blocks, but each tripped gate
 * logs + emits a PostHog event for calibration. The system breaker additionally
 * fires a loud event + `captureServerException` (throttled) whenever it trips —
 * that's the "someone is draining the wallet" signal. A monthly block overrides
 * `check.retryAfterSeconds` to the month reset so the 429's `Retry-After` is
 * honest ("next month", not "tomorrow").
 */
export async function guardDailyLimit(
  userId: string,
  bucket: UsageBucket,
): Promise<UsageGuardResult> {
  warnIfLimitsNotEnforced();
  const check = await assertWithinDailyLimit(userId, bucket);
  const enforced = isUsageLimitsEnforced();

  // Gate 1 — per-bucket action count.
  const countAction = resolveGuardAction(check.allowed, enforced);
  if (countAction === "block") {
    log.warn(
      { userId, bucket, count: check.count, limit: check.limit },
      "Daily usage limit reached — blocking (enforced)",
    );
    return { ok: false, action: "block", reason: "count", check };
  }
  if (countAction === "shadow") {
    log.warn(
      { userId, bucket, count: check.count, limit: check.limit },
      "Daily usage limit would block (shadow mode — not enforced)",
    );
    emitUsagePostHog("usage_limit_would_block", userId, {
      userId,
      bucket,
      count: check.count,
      limit: check.limit,
    });
  }

  // Gate 2 — system-wide $ circuit-breaker (most severe: halts everyone).
  const system = await safeSystemBudget();
  if (system) {
    const systemAction = resolveGuardAction(system.underBudget, enforced);
    if (systemAction !== "allow") {
      const props = {
        scope: "system" as const,
        spentUsd: system.spentUsd,
        limitUsd: system.limitUsd,
        userId,
        bucket,
        enforced,
      };
      log.error(
        props,
        enforced
          ? "System daily $ budget exceeded — halting all new paid actions (enforced)"
          : "System daily $ budget would halt all new paid actions (shadow mode)",
      );
      // Throttle the loud signal so a sustained breach doesn't storm PostHog /
      // exception tracking — one alert per cache window is enough to page on.
      if (shouldEmitSystemBreachAlert()) {
        emitUsagePostHog("system_daily_budget_exceeded", userId, props);
        captureServerException(
          new Error(
            `System daily $ budget exceeded: $${system.spentUsd.toFixed(2)} ≥ $${system.limitUsd.toFixed(2)}`,
          ),
          userId,
          props,
        );
      }
      if (systemAction === "block") {
        return { ok: false, action: "block", reason: "system_budget", check };
      }
    }
  }

  // Gate 3 — per-user monthly $ cap (the binding economic ceiling).
  const monthly = await safeUserMonthlyBudget(userId);
  if (monthly) {
    const monthlyAction = resolveGuardAction(monthly.underBudget, enforced);
    if (monthlyAction !== "allow") {
      const props = {
        scope: "user_monthly" as const,
        spentUsd: monthly.spentUsd,
        limitUsd: monthly.limitUsd,
        userId,
        bucket,
        enforced,
      };
      log.warn(
        props,
        enforced
          ? "Per-user monthly $ budget exceeded — blocking (enforced)"
          : "Per-user monthly $ budget would block (shadow mode)",
      );
      emitUsagePostHog("user_monthly_budget_exceeded", userId, props);
      if (monthlyAction === "block") {
        // A monthly block resets next month, not at midnight — give an honest
        // Retry-After by overriding the (daily) window on the returned check.
        return {
          ok: false,
          action: "block",
          reason: "user_monthly_budget",
          check: { ...check, retryAfterSeconds: secondsUntilUtcMonthStart() },
        };
      }
    }
  }

  // Gate 4 — per-user daily $ cap (the spike limiter).
  const daily = await safeUserDailyBudget(userId);
  if (daily) {
    const dailyAction = resolveGuardAction(daily.underBudget, enforced);
    if (dailyAction !== "allow") {
      const props = {
        scope: "user_daily" as const,
        spentUsd: daily.spentUsd,
        limitUsd: daily.limitUsd,
        userId,
        bucket,
        enforced,
      };
      log.warn(
        props,
        enforced
          ? "Per-user daily $ budget exceeded — blocking (enforced)"
          : "Per-user daily $ budget would block (shadow mode)",
      );
      emitUsagePostHog("user_daily_budget_exceeded", userId, props);
      if (dailyAction === "block") {
        return {
          ok: false,
          action: "block",
          reason: "user_daily_budget",
          check,
        };
      }
    }
  }

  // Reached only when no gate enforced-blocked. Distinguish a clean allow from
  // shadow (a gate would have blocked, but enforcement is off). Priority mirrors
  // the evaluation order above.
  const wouldBlockReason: GuardReason | undefined =
    countAction === "shadow"
      ? "count"
      : system && !system.underBudget
        ? "system_budget"
        : monthly && !monthly.underBudget
          ? "user_monthly_budget"
          : daily && !daily.underBudget
            ? "user_daily_budget"
            : undefined;

  if (wouldBlockReason) {
    return { ok: true, action: "shadow", check, reason: wouldBlockReason };
  }
  return { ok: true, action: "allow", check };
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
  const limitUsd = perUserDailyUsdLimit();

  return {
    underBudget: spentUsd < limitUsd,
    spentUsd,
    limitUsd,
  };
}

export type UserMonthlyBudget = {
  /** True while this calendar month's summed spend is below the monthly cap. */
  underBudget: boolean;
  spentUsd: number;
  limitUsd: number;
};

/**
 * Primary per-user economic ceiling: sum this UTC calendar month's `cost_usd`
 * across all buckets for a user vs the monthly cap. The daily cap allows spiky
 * bursts; this bounds the month. Cache-free (≤ ~31 days × a few buckets per user)
 * and bounded by the `usage_daily(day)` index.
 */
export async function assertUserMonthlyBudget(
  userId: string,
): Promise<UserMonthlyBudget> {
  const rows = await db.$queryRaw<{ sum: string }[]>`
    SELECT COALESCE(SUM(cost_usd), 0)::text AS sum
    FROM usage_daily
    WHERE user_id = ${userId}::uuid
      AND day >= date_trunc('month', (now() AT TIME ZONE 'utc'))::date
  `;

  const spentUsd = Number(rows[0]?.sum ?? "0");
  const limitUsd = perUserMonthlyUsdLimit();

  return {
    underBudget: spentUsd < limitUsd,
    spentUsd,
    limitUsd,
  };
}

export type SystemDailyBudget = {
  /** True while today's summed spend across ALL users is below the breaker. */
  underBudget: boolean;
  spentUsd: number;
  limitUsd: number;
};

/**
 * How long a system-spend read (and the loud-alert throttle) stays warm. The
 * SUM runs on every paid request across all users, so we memoise it briefly to
 * keep the request path cheap while still catching a runaway within ~30s.
 */
const SYSTEM_SPEND_CACHE_TTL_MS = 30_000;

let systemSpendCache: { spentUsd: number; fetchedAtMs: number } | null = null;
let lastSystemBreachAlertMs: number | null = null;

/**
 * Test-only: clear the memoised system spend + alert throttle so each test reads
 * fresh state. The cache/throttle are module-level and would otherwise leak
 * across tests (and across the UTC-day boundary — see `systemSpendTodayUsd`).
 */
export function resetSystemBudgetStateForTests(): void {
  systemSpendCache = null;
  lastSystemBreachAlertMs = null;
}

/**
 * Today's total `cost_usd` across all users, memoised for
 * `SYSTEM_SPEND_CACHE_TTL_MS`. Aggregate is bounded by the `usage_daily(day)`
 * index. The cache isn't keyed on the UTC day, so for up to one TTL after
 * midnight it can carry the previous day's (higher) sum — a conservative error
 * that only makes the breaker trip slightly more eagerly, never less.
 */
async function systemSpendTodayUsd(): Promise<number> {
  const nowMs = Date.now();
  if (
    systemSpendCache &&
    nowMs - systemSpendCache.fetchedAtMs < SYSTEM_SPEND_CACHE_TTL_MS
  ) {
    return systemSpendCache.spentUsd;
  }

  const rows = await db.$queryRaw<{ sum: string }[]>`
    SELECT COALESCE(SUM(cost_usd), 0)::text AS sum
    FROM usage_daily
    WHERE day = (now() AT TIME ZONE 'utc')::date
  `;

  const spentUsd = Number(rows[0]?.sum ?? "0");
  systemSpendCache = { spentUsd, fetchedAtMs: nowMs };
  return spentUsd;
}

/**
 * Whether to fire the loud breach alert now, throttled to once per
 * `SYSTEM_SPEND_CACHE_TTL_MS` so a sustained breach doesn't storm PostHog /
 * exception tracking with one event per blocked request.
 */
function shouldEmitSystemBreachAlert(): boolean {
  const nowMs = Date.now();
  if (
    lastSystemBreachAlertMs !== null &&
    nowMs - lastSystemBreachAlertMs < SYSTEM_SPEND_CACHE_TTL_MS
  ) {
    return false;
  }
  lastSystemBreachAlertMs = nowMs;
  return true;
}

/**
 * System-wide circuit-breaker: sum today's `cost_usd` across ALL users and
 * report whether the platform is under the daily $ breaker. The catastrophe stop
 * for "someone is draining the wallet" — an attack the per-user/per-bucket gates
 * can miss (many accounts, or few expensive calls).
 */
export async function assertSystemDailyBudget(): Promise<SystemDailyBudget> {
  const spentUsd = await systemSpendTodayUsd();
  const limitUsd = systemDailyUsdLimit();

  return {
    underBudget: spentUsd < limitUsd,
    spentUsd,
    limitUsd,
  };
}
