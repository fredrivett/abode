/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import {
  accrueUsageCost,
  assertUserDailyBudget,
  assertWithinDailyLimit,
  DAILY_LIMITS,
} from "@/lib/usage-limits";

describe("usage-limits integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const createUser = async (email = "usage@example.com") => {
    const { write } = await import("@/lib/db");
    return write.user.create({ data: { id: crypto.randomUUID(), email } });
  };

  const rowFor = async (userId: string, bucket: string) => {
    const { read } = await import("@/lib/db");
    const rows = await read.$queryRaw<{ count: number; cost_usd: string }[]>`
      SELECT count, cost_usd::text AS cost_usd
      FROM usage_daily
      WHERE user_id = ${userId}::uuid
        AND day = (now() AT TIME ZONE 'utc')::date
        AND bucket = ${bucket}
    `;
    return rows[0] ?? null;
  };

  test("increments the count by one per call", async () => {
    const user = await createUser();
    const first = await assertWithinDailyLimit(user.id, "reanalysis");
    const second = await assertWithinDailyLimit(user.id, "reanalysis");
    const third = await assertWithinDailyLimit(user.id, "reanalysis");

    expect([first.count, second.count, third.count]).toEqual([1, 2, 3]);
    expect(first.allowed).toBe(true);
    expect(first.limit).toBe(DAILY_LIMITS.reanalysis);
    expect(first.retryAfterSeconds).toBeGreaterThan(0);
  });

  test("allows exactly up to the limit, then keeps counting but denies", async () => {
    const user = await createUser();
    const limit = DAILY_LIMITS.reanalysis; // 20

    const results = [];
    for (let i = 0; i < limit + 2; i++) {
      results.push(await assertWithinDailyLimit(user.id, "reanalysis"));
    }

    // The first `limit` calls are allowed; the boundary is inclusive.
    expect(results.filter((r) => r.allowed).length).toBe(limit);
    expect(results[limit - 1].allowed).toBe(true); // count === limit → allowed
    expect(results[limit].allowed).toBe(false); // count === limit + 1 → denied
    // The count keeps climbing past the limit (unconditional increment) so the
    // stored figure reflects true demand for shadow-mode calibration.
    expect(results[limit + 1].count).toBe(limit + 2);
  });

  test("concurrent calls never allow more than the limit (race safety)", async () => {
    const user = await createUser();
    const limit = DAILY_LIMITS.reanalysis; // 20
    const attempts = limit * 2; // 40 fired in parallel

    const results = await Promise.all(
      Array.from({ length: attempts }, () =>
        assertWithinDailyLimit(user.id, "reanalysis"),
      ),
    );

    // Exactly `limit` allowed — the atomic upsert can't be raced past it.
    expect(results.filter((r) => r.allowed).length).toBe(limit);
    // Every call got a distinct count: no double-counts, no skipped values.
    const counts = results.map((r) => r.count).sort((a, b) => a - b);
    expect(counts).toEqual(Array.from({ length: attempts }, (_, i) => i + 1));

    const row = await rowFor(user.id, "reanalysis");
    expect(row?.count).toBe(attempts);
  });

  test("counters reset across the UTC day boundary", async () => {
    const user = await createUser();
    const { write } = await import("@/lib/db");

    // Seed a *yesterday* row already at the limit.
    await write.$executeRaw`
      INSERT INTO usage_daily (user_id, day, bucket, count, updated_at)
      VALUES (
        ${user.id}::uuid,
        (now() AT TIME ZONE 'utc')::date - 1,
        'reanalysis',
        ${DAILY_LIMITS.reanalysis},
        now()
      )
    `;

    // Today starts fresh at 1 and is allowed.
    const today = await assertWithinDailyLimit(user.id, "reanalysis");
    expect(today.count).toBe(1);
    expect(today.allowed).toBe(true);

    // Yesterday's row is untouched.
    const yesterday = await write.$queryRaw<{ count: number }[]>`
      SELECT count FROM usage_daily
      WHERE user_id = ${user.id}::uuid
        AND day = (now() AT TIME ZONE 'utc')::date - 1
        AND bucket = 'reanalysis'
    `;
    expect(Number(yesterday[0]?.count)).toBe(DAILY_LIMITS.reanalysis);
  });

  test("buckets are counted independently", async () => {
    const user = await createUser();
    await assertWithinDailyLimit(user.id, "ingestion");
    await assertWithinDailyLimit(user.id, "ingestion");
    const reanalysis = await assertWithinDailyLimit(user.id, "reanalysis");
    expect(reanalysis.count).toBe(1);
  });

  test("accrueUsageCost sums onto the row without touching count", async () => {
    const user = await createUser();
    await assertWithinDailyLimit(user.id, "ingestion"); // creates row, count 1
    await accrueUsageCost(user.id, "ingestion", 0.25);
    await accrueUsageCost(user.id, "ingestion", 0.5);

    const row = await rowFor(user.id, "ingestion");
    expect(row?.count).toBe(1);
    expect(Number(row?.cost_usd)).toBeCloseTo(0.75, 4);
  });

  test("accrueUsageCost upserts a missing row with count 0", async () => {
    const user = await createUser();
    await accrueUsageCost(user.id, "search", 0.1);

    const row = await rowFor(user.id, "search");
    expect(row?.count).toBe(0);
    expect(Number(row?.cost_usd)).toBeCloseTo(0.1, 4);
  });

  test("accrueUsageCost ignores non-positive / non-finite amounts", async () => {
    const user = await createUser();
    await accrueUsageCost(user.id, "ingestion", 0);
    await accrueUsageCost(user.id, "ingestion", -5);
    await accrueUsageCost(user.id, "ingestion", Number.NaN);
    expect(await rowFor(user.id, "ingestion")).toBeNull();
  });

  test("assertUserDailyBudget sums cost across buckets vs the cap", async () => {
    const user = await createUser();
    await accrueUsageCost(user.id, "ingestion", 0.75);
    await accrueUsageCost(user.id, "reanalysis", 0.5);

    const budget = await assertUserDailyBudget(user.id);
    expect(budget.spentUsd).toBeCloseTo(1.25, 4);
    expect(budget.limitUsd).toBe(2.0);
    expect(budget.underBudget).toBe(true);
  });

  test("assertUserDailyBudget flips to over-budget past the cap", async () => {
    const user = await createUser();
    await accrueUsageCost(user.id, "ingestion", 2.5); // over the $2.00 cap
    const budget = await assertUserDailyBudget(user.id);
    expect(budget.underBudget).toBe(false);
  });

  test("assertUserDailyBudget reports zero for a user with no usage", async () => {
    const user = await createUser();
    const budget = await assertUserDailyBudget(user.id);
    expect(budget.spentUsd).toBe(0);
    expect(budget.underBudget).toBe(true);
  });
});
