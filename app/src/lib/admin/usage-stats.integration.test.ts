/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import {
  getGlobalUsageToday,
  getUsersUsageToday,
  getUserUsageBreakdown,
} from "@/lib/admin/usage-stats";
import {
  DAILY_LIMITS,
  PER_USER_DAILY_USD,
  PER_USER_MONTHLY_USD,
  SYSTEM_DAILY_USD,
} from "@/lib/usage-limits";

describe("admin usage-stats integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const createUser = async (email: string) => {
    const { write } = await import("@/lib/db");
    return write.user.create({ data: { id: crypto.randomUUID(), email } });
  };

  const seed = async (
    userId: string,
    bucket: string,
    count: number,
    costUsd: number,
    dayOffset = 0,
  ) => {
    const { write } = await import("@/lib/db");
    await write.$executeRaw`
      INSERT INTO usage_daily (user_id, day, bucket, count, cost_usd, updated_at)
      VALUES (
        ${userId}::uuid,
        (now() AT TIME ZONE 'utc')::date + ${dayOffset}::int,
        ${bucket},
        ${count},
        ${costUsd}::numeric,
        now()
      )
    `;
  };

  test("getUsersUsageToday sums counts + cost and flags no over-cap under limits", async () => {
    const user = await createUser("a@example.com");
    await seed(user.id, "ingestion", 3, 0.4);
    await seed(user.id, "reanalysis", 2, 0.1);

    const map = await getUsersUsageToday([user.id]);
    const row = map.get(user.id);

    expect(row?.actionCount).toBe(5);
    expect(row?.costUsd).toBeCloseTo(0.5, 4);
    expect(row?.overCap).toBe(false);
  });

  test("getUsersUsageToday omits users with no usage and handles empty input", async () => {
    const user = await createUser("b@example.com");
    expect((await getUsersUsageToday([user.id])).has(user.id)).toBe(false);
    expect((await getUsersUsageToday([])).size).toBe(0);
  });

  test("over-cap trips when a bucket reaches its daily limit", async () => {
    const user = await createUser("c@example.com");
    await seed(user.id, "reanalysis", DAILY_LIMITS.reanalysis, 0.05);

    const row = (await getUsersUsageToday([user.id])).get(user.id);
    expect(row?.overCap).toBe(true);
  });

  test("over-cap trips on the per-user $ cap even with low counts", async () => {
    const user = await createUser("d@example.com");
    await seed(user.id, "ingestion", 1, PER_USER_DAILY_USD + 0.5);

    const row = (await getUsersUsageToday([user.id])).get(user.id);
    expect(row?.overCap).toBe(true);
  });

  test("getGlobalUsageToday totals spend and counts users over cap", async () => {
    const under = await createUser("under@example.com");
    const over = await createUser("over@example.com");
    await seed(under.id, "ingestion", 2, 0.25);
    await seed(over.id, "reanalysis", DAILY_LIMITS.reanalysis, 1.0);

    const global = await getGlobalUsageToday();
    expect(global.totalCostUsd).toBeCloseTo(1.25, 4);
    expect(global.totalMonthCostUsd).toBeCloseTo(1.25, 4);
    expect(global.activeUsers).toBe(2);
    expect(global.usersOverCap).toBe(1);
    // Thresholds/state come straight from usage-limits (single source of truth).
    expect(global.systemDailyLimitUsd).toBe(SYSTEM_DAILY_USD);
    expect(global.enforced).toBe(false); // unset + NODE_ENV=test → shadow
  });

  test("earlier-day rows are excluded from today but count toward the month", async () => {
    const user = await createUser("e@example.com");
    await seed(user.id, "ingestion", 99, 4.0, -1); // an earlier day, large

    // Today window excludes earlier days.
    const global = await getGlobalUsageToday();
    expect(global.totalCostUsd).toBe(0); // no spend *today*
    expect(global.activeUsers).toBe(0); // no usage *today*

    const row = (await getUsersUsageToday([user.id])).get(user.id);
    expect(row?.costUsd ?? 0).toBe(0); // today's spend is zero
    expect(row?.actionCount ?? 0).toBe(0);
  });

  test("month-to-date spend counts earlier days and trips the monthly cap", async () => {
    const user = await createUser("mtd@example.com");
    const { write } = await import("@/lib/db");
    // A row on the 1st of this month — deterministically within the month window,
    // regardless of today's date. Over the monthly cap.
    await write.$executeRaw`
      INSERT INTO usage_daily (user_id, day, bucket, count, cost_usd, updated_at)
      VALUES (
        ${user.id}::uuid,
        date_trunc('month', (now() AT TIME ZONE 'utc'))::date,
        'ingestion',
        1,
        ${PER_USER_MONTHLY_USD + 1}::numeric,
        now()
      )
    `;

    const row = (await getUsersUsageToday([user.id])).get(user.id);
    expect(row?.monthCostUsd).toBeCloseTo(PER_USER_MONTHLY_USD + 1, 4);
    expect(row?.overCap).toBe(true); // over the monthly $ cap

    const global = await getGlobalUsageToday();
    expect(global.totalMonthCostUsd).toBeCloseTo(PER_USER_MONTHLY_USD + 1, 4);
    expect(global.usersOverCap).toBe(1);
  });

  test("getUserUsageBreakdown reports each gated bucket vs its limit", async () => {
    const user = await createUser("f@example.com");
    await seed(user.id, "ingestion", 4, 0.6);
    await seed(user.id, "location", 1, 0);

    const breakdown = await getUserUsageBreakdown(user.id);

    expect(breakdown.buckets.map((b) => b.bucket)).toEqual([
      "ingestion",
      "reanalysis",
      "location",
    ]);
    const ingestion = breakdown.buckets.find((b) => b.bucket === "ingestion");
    expect(ingestion?.count).toBe(4);
    expect(ingestion?.limit).toBe(DAILY_LIMITS.ingestion);
    const reanalysis = breakdown.buckets.find((b) => b.bucket === "reanalysis");
    expect(reanalysis?.count).toBe(0); // no row → zero, not missing
    expect(breakdown.totalCostUsd).toBeCloseTo(0.6, 4);
    expect(breakdown.monthCostUsd).toBeCloseTo(0.6, 4);
    expect(breakdown.dailyLimitUsd).toBe(PER_USER_DAILY_USD);
    expect(breakdown.monthlyLimitUsd).toBe(PER_USER_MONTHLY_USD);
    expect(breakdown.overCap).toBe(false);
  });
});
