import { Prisma } from "@prisma/client";
import db from "@/lib/db";
import {
  DAILY_LIMITS,
  isUsageLimitsEnforced,
  perUserDailyUsdLimit,
  perUserMonthlyUsdLimit,
  systemDailyUsdLimit,
  type UsageBucket,
} from "@/lib/usage-limits";

/**
 * Read-only admin aggregates over the `usage_daily` rollup (see
 * plan-user-daily-limits.md, "surface it in the admin interface").
 *
 * Enforcement lives in `usage-limits.ts`; this module only reads, reusing
 * `DAILY_LIMITS` / `perUserDailyUsdLimit()` / `perUserMonthlyUsdLimit()` /
 * `systemDailyUsdLimit()` as the single source of truth for the thresholds so
 * the admin view can't drift from what actually gates requests.
 *
 * Two windows: per-bucket COUNTS + a TOTAL $ for *today* (UTC day), and a
 * month-to-date TOTAL $ (UTC calendar month) for the binding monthly cap. Cost
 * attribution is coarse by design: `count` is per bucket, but `cost_usd` is only
 * accrued to `ingestion`/`search`/`location`, so we never surface a per-bucket $
 * that would mislead — only per-user/day and per-user/month totals.
 */

/**
 * Buckets shown in the per-user breakdown — the ones the route guards actually
 * count (the `guardDailyLimit` call sites). `search`/`emoji` are reserved in
 * `DAILY_LIMITS` but not yet gated, so they carry no counts.
 */
const BREAKDOWN_BUCKETS = [
  "ingestion",
  "reanalysis",
  "location",
] as const satisfies readonly UsageBucket[];

const BUCKET_LABELS: Record<(typeof BREAKDOWN_BUCKETS)[number], string> = {
  ingestion: "Item capture",
  reanalysis: "Re-analysis",
  location: "Location",
};

type UsageRow = {
  user_id: string;
  bucket: string;
  count: number;
  cost_usd: string;
};

function isUsageBucket(value: string): value is UsageBucket {
  return value in DAILY_LIMITS;
}

function groupByUser(rows: UsageRow[]): Map<string, UsageRow[]> {
  const byUser = new Map<string, UsageRow[]>();
  for (const row of rows) {
    const existing = byUser.get(row.user_id);
    if (existing) existing.push(row);
    else byUser.set(row.user_id, [row]);
  }
  return byUser;
}

export type UserUsageToday = {
  /** Total gated actions today (item capture + re-analysis + location). */
  actionCount: number;
  /** Total paid AI spend accrued today, across all buckets. */
  costUsd: number;
  /** Total paid AI spend this UTC calendar month, across all buckets. */
  monthCostUsd: number;
  /** Over a bucket's daily count or the per-user daily $ cap (a *today* breach). */
  overDailyCap: boolean;
  /** Over the per-user monthly $ cap (a *month-to-date* breach). */
  overMonthlyCap: boolean;
  /** Over any cap — `overDailyCap || overMonthlyCap`. */
  overCap: boolean;
};

/**
 * Reduce a user's today rows + month-to-date spend into display totals + the
 * over-cap verdicts. Split by window so the UI can attribute the breach to the
 * right figure: `overDailyCap` = any bucket at/over its `DAILY_LIMITS` count or
 * today's spend at/over the daily $ cap; `overMonthlyCap` = this month's spend
 * at/over the monthly $ cap.
 */
function evaluateUser(rows: UsageRow[], monthCostUsd: number): UserUsageToday {
  let actionCount = 0;
  let costUsd = 0;
  // Explicit boolean (not the `false` literal) so it's reassignable to true
  // without the flow analysis narrowing it away.
  let overDailyCap: boolean = false;

  for (const row of rows) {
    actionCount += row.count;
    costUsd += Number(row.cost_usd);
    if (isUsageBucket(row.bucket) && row.count >= DAILY_LIMITS[row.bucket]) {
      overDailyCap = true;
    }
  }

  if (costUsd >= perUserDailyUsdLimit()) overDailyCap = true;
  const overMonthlyCap = monthCostUsd >= perUserMonthlyUsdLimit();

  return {
    actionCount,
    costUsd,
    monthCostUsd,
    overDailyCap,
    overMonthlyCap,
    overCap: overDailyCap || overMonthlyCap,
  };
}

/** Today's per-bucket rows (counts + today's $) for the given scope. */
async function selectTodayRows(where: Prisma.Sql): Promise<UsageRow[]> {
  return db.$queryRaw<UsageRow[]>`
    SELECT user_id, bucket, count, cost_usd::text AS cost_usd
    FROM usage_daily
    WHERE day = (now() AT TIME ZONE 'utc')::date
      AND ${where}
  `;
}

/**
 * Month-to-date $ per user for the given scope (UTC calendar month). Bounded by
 * the `usage_daily(day)` index; users with no month spend are absent from the map.
 */
async function sumMonthCostByUser(
  where: Prisma.Sql,
): Promise<Map<string, number>> {
  const rows = await db.$queryRaw<{ user_id: string; cost_usd: string }[]>`
    SELECT user_id, COALESCE(SUM(cost_usd), 0)::text AS cost_usd
    FROM usage_daily
    WHERE day >= date_trunc('month', (now() AT TIME ZONE 'utc'))::date
      AND ${where}
    GROUP BY user_id
  `;
  return new Map(rows.map((r) => [r.user_id, Number(r.cost_usd)]));
}

export type GlobalUsageToday = {
  /** Total paid AI spend today across all users (= system daily spend). */
  totalCostUsd: number;
  /** Total paid AI spend this UTC calendar month across all users. */
  totalMonthCostUsd: number;
  /** Users over any bucket count, the per-user daily $ cap, or monthly $ cap. */
  usersOverCap: number;
  /** Users with any usage today. */
  activeUsers: number;
  /** The system-wide daily $ circuit-breaker the daily spend is measured against. */
  systemDailyLimitUsd: number;
  /** Whether limits actually block here (vs shadow) — see isUsageLimitsEnforced. */
  enforced: boolean;
};

/** Platform-wide usage totals for today + month-to-date (admin dashboard). */
export async function getGlobalUsageToday(): Promise<GlobalUsageToday> {
  const [todayRows, monthByUser] = await Promise.all([
    selectTodayRows(Prisma.sql`TRUE`),
    sumMonthCostByUser(Prisma.sql`TRUE`),
  ]);
  const byUser = groupByUser(todayRows);

  let totalCostUsd = 0;
  let totalMonthCostUsd = 0;
  let usersOverCap = 0;
  // Union of today-active and month-active users — a user over the monthly cap
  // but idle today must still count as over-cap.
  const userIds = new Set<string>([...byUser.keys(), ...monthByUser.keys()]);
  for (const userId of userIds) {
    const monthCost = monthByUser.get(userId) ?? 0;
    const { costUsd, overCap } = evaluateUser(
      byUser.get(userId) ?? [],
      monthCost,
    );
    totalCostUsd += costUsd;
    totalMonthCostUsd += monthCost;
    if (overCap) usersOverCap += 1;
  }

  return {
    totalCostUsd,
    totalMonthCostUsd,
    usersOverCap,
    activeUsers: byUser.size,
    systemDailyLimitUsd: systemDailyUsdLimit(),
    enforced: isUsageLimitsEnforced(),
  };
}

/**
 * Today's usage keyed by user, for the given (already-paginated) user IDs.
 * Users with no usage today are simply absent from the map — callers default
 * to a zero row. One query, no N+1.
 */
export async function getUsersUsageToday(
  userIds: string[],
): Promise<Map<string, UserUsageToday>> {
  const result = new Map<string, UserUsageToday>();
  if (userIds.length === 0) return result;

  const idList = Prisma.join(userIds.map((id) => Prisma.sql`${id}::uuid`));
  const where = Prisma.sql`user_id IN (${idList})`;
  const [todayRows, monthByUser] = await Promise.all([
    selectTodayRows(where),
    sumMonthCostByUser(where),
  ]);
  const byUser = groupByUser(todayRows);

  // Union so a user with only month spend (idle today) still gets a row.
  const ids = new Set<string>([...byUser.keys(), ...monthByUser.keys()]);
  for (const userId of ids) {
    result.set(
      userId,
      evaluateUser(byUser.get(userId) ?? [], monthByUser.get(userId) ?? 0),
    );
  }
  return result;
}

export type UsageBucketBreakdown = {
  bucket: UsageBucket;
  label: string;
  count: number;
  limit: number;
};

export type UserUsageBreakdown = {
  buckets: UsageBucketBreakdown[];
  /** Total paid AI spend today. */
  totalCostUsd: number;
  /** Total paid AI spend this UTC calendar month. */
  monthCostUsd: number;
  /** Per-user daily $ cap `totalCostUsd` is measured against. */
  dailyLimitUsd: number;
  /** Per-user monthly $ cap `monthCostUsd` is measured against. */
  monthlyLimitUsd: number;
  overCap: boolean;
};

/**
 * Per-bucket counts vs limits + today's and month-to-date spend vs the $ caps,
 * for one user (detail page).
 */
export async function getUserUsageBreakdown(
  userId: string,
): Promise<UserUsageBreakdown> {
  const where = Prisma.sql`user_id = ${userId}::uuid`;
  const [rows, monthByUser] = await Promise.all([
    selectTodayRows(where),
    sumMonthCostByUser(where),
  ]);
  const monthCostUsd = monthByUser.get(userId) ?? 0;

  const countByBucket = new Map<string, number>();
  for (const row of rows) countByBucket.set(row.bucket, row.count);

  const buckets = BREAKDOWN_BUCKETS.map((bucket) => ({
    bucket,
    label: BUCKET_LABELS[bucket],
    count: countByBucket.get(bucket) ?? 0,
    limit: DAILY_LIMITS[bucket],
  }));

  const { costUsd, overCap } = evaluateUser(rows, monthCostUsd);
  return {
    buckets,
    totalCostUsd: costUsd,
    monthCostUsd,
    dailyLimitUsd: perUserDailyUsdLimit(),
    monthlyLimitUsd: perUserMonthlyUsdLimit(),
    overCap,
  };
}

export type DailyCost = {
  /** UTC day, `YYYY-MM-DD`. */
  date: string;
  /** System-wide paid AI spend that day, across all users. */
  costUsd: number;
};

/**
 * System-wide paid AI spend per UTC day for the last `days` days, oldest→newest
 * and DENSE (zero-filled) so the trend chart has a bar per day. Bounded by the
 * `usage_daily(day)` index.
 */
export async function getDailyCostTrend(days = 14): Promise<DailyCost[]> {
  const rows = await db.$queryRaw<{ day: string; cost_usd: string }[]>`
    SELECT day::text AS day, COALESCE(SUM(cost_usd), 0)::text AS cost_usd
    FROM usage_daily
    WHERE day >= (now() AT TIME ZONE 'utc')::date - ${days - 1}::int
    GROUP BY day
  `;
  const byDay = new Map(rows.map((r) => [r.day, Number(r.cost_usd)]));

  const now = new Date();
  const result: DailyCost[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i),
    );
    const date = d.toISOString().slice(0, 10);
    result.push({ date, costUsd: byDay.get(date) ?? 0 });
  }
  return result;
}

export type TopSpender = {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  /** Paid AI spend this UTC calendar month. */
  monthCostUsd: number;
};

/**
 * Users with the most month-to-date paid AI spend (descending), for the admin
 * costs page. Two queries (sum, then user lookup) — no N+1. Zero-spend users
 * are excluded.
 */
export async function getTopSpendersThisMonth(
  limit = 10,
): Promise<TopSpender[]> {
  const rows = await db.$queryRaw<{ user_id: string; cost_usd: string }[]>`
    SELECT user_id, SUM(cost_usd)::text AS cost_usd
    FROM usage_daily
    WHERE day >= date_trunc('month', (now() AT TIME ZONE 'utc'))::date
    GROUP BY user_id
    HAVING SUM(cost_usd) > 0
    ORDER BY SUM(cost_usd) DESC
    LIMIT ${limit}
  `;
  if (rows.length === 0) return [];

  const users = await db.user.findMany({
    where: { id: { in: rows.map((r) => r.user_id) } },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      username: true,
    },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  // Preserve the SQL spend-descending order.
  return rows.map((r) => {
    const u = byId.get(r.user_id);
    return {
      userId: r.user_id,
      email: u?.email ?? "(unknown)",
      firstName: u?.firstName ?? null,
      lastName: u?.lastName ?? null,
      username: u?.username ?? null,
      monthCostUsd: Number(r.cost_usd),
    };
  });
}
