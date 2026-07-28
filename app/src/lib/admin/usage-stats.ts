import { Prisma } from "@prisma/client";
import db from "@/lib/db";
import {
  DAILY_LIMITS,
  PER_USER_DAILY_USD,
  type UsageBucket,
} from "@/lib/usage-limits";

/**
 * Read-only admin aggregates over the `usage_daily` rollup (see
 * plan-user-daily-limits.md, "surface it in the admin interface").
 *
 * Enforcement lives in `usage-limits.ts`; this module only reads, reusing
 * `DAILY_LIMITS` / `PER_USER_DAILY_USD` as the single source of truth for the
 * thresholds so the admin view can't drift from what actually gates requests.
 *
 * Cost attribution is coarse by design: `count` is tracked per bucket, but
 * `cost_usd` is only accrued to the `ingestion`/`search` buckets (re-analysis
 * and location pipeline spend lands in `ingestion`). So we surface per-bucket
 * COUNTS and a per-user/day TOTAL $ — never a per-bucket $ that would mislead.
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
  /** Hit any bucket's daily action limit, or crossed the per-user $ cap. */
  overCap: boolean;
};

/**
 * Reduce a user's rows for the day into display totals + the over-cap verdict.
 * "Over cap" mirrors the enforcement rules: any bucket at/over its
 * `DAILY_LIMITS` count, or today's total spend at/over `PER_USER_DAILY_USD`.
 */
function evaluateUser(rows: UsageRow[]): UserUsageToday {
  let actionCount = 0;
  let costUsd = 0;
  let overCap = false;

  for (const row of rows) {
    actionCount += row.count;
    costUsd += Number(row.cost_usd);
    if (isUsageBucket(row.bucket) && row.count >= DAILY_LIMITS[row.bucket]) {
      overCap = true;
    }
  }

  if (costUsd >= PER_USER_DAILY_USD) overCap = true;

  return { actionCount, costUsd, overCap };
}

async function selectUsageRows(where: Prisma.Sql): Promise<UsageRow[]> {
  return db.$queryRaw<UsageRow[]>`
    SELECT user_id, bucket, count, cost_usd::text AS cost_usd
    FROM usage_daily
    WHERE day = (now() AT TIME ZONE 'utc')::date
      AND ${where}
  `;
}

export type GlobalUsageToday = {
  /** Total paid AI spend today across all users. */
  totalCostUsd: number;
  /** Users who hit a bucket limit or the per-user $ cap today. */
  usersOverCap: number;
  /** Users with any usage today. */
  activeUsers: number;
};

/** Platform-wide usage totals for today (admin dashboard stat cards). */
export async function getGlobalUsageToday(): Promise<GlobalUsageToday> {
  const rows = await selectUsageRows(Prisma.sql`TRUE`);
  const byUser = groupByUser(rows);

  let totalCostUsd = 0;
  let usersOverCap = 0;
  for (const userRows of byUser.values()) {
    const { costUsd, overCap } = evaluateUser(userRows);
    totalCostUsd += costUsd;
    if (overCap) usersOverCap += 1;
  }

  return { totalCostUsd, usersOverCap, activeUsers: byUser.size };
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
  const rows = await selectUsageRows(Prisma.sql`user_id IN (${idList})`);

  for (const [userId, userRows] of groupByUser(rows)) {
    result.set(userId, evaluateUser(userRows));
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
  totalCostUsd: number;
  overCap: boolean;
};

/** Per-bucket counts vs limits + total spend for one user today (detail page). */
export async function getUserUsageBreakdown(
  userId: string,
): Promise<UserUsageBreakdown> {
  const rows = await selectUsageRows(Prisma.sql`user_id = ${userId}::uuid`);

  const countByBucket = new Map<string, number>();
  for (const row of rows) countByBucket.set(row.bucket, row.count);

  const buckets = BREAKDOWN_BUCKETS.map((bucket) => ({
    bucket,
    label: BUCKET_LABELS[bucket],
    count: countByBucket.get(bucket) ?? 0,
    limit: DAILY_LIMITS[bucket],
  }));

  const { costUsd, overCap } = evaluateUser(rows);
  return { buckets, totalCostUsd: costUsd, overCap };
}
