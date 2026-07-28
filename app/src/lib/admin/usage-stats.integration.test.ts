/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import {
  getGlobalUsageToday,
  getUsersUsageToday,
  getUserUsageBreakdown,
} from "@/lib/admin/usage-stats";
import { DAILY_LIMITS, PER_USER_DAILY_USD } from "@/lib/usage-limits";

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
    expect(global.activeUsers).toBe(2);
    expect(global.usersOverCap).toBe(1);
  });

  test("yesterday's rows are excluded from today's aggregates", async () => {
    const user = await createUser("e@example.com");
    await seed(user.id, "ingestion", 99, 5.0, -1); // yesterday, huge

    const map = await getUsersUsageToday([user.id]);
    expect(map.has(user.id)).toBe(false);

    const global = await getGlobalUsageToday();
    expect(global.totalCostUsd).toBe(0);
    expect(global.usersOverCap).toBe(0);
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
    expect(breakdown.overCap).toBe(false);
  });
});
