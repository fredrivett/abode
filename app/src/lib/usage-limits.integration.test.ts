/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import {
  accrueUsageCost,
  assertSystemDailyBudget,
  assertUserDailyBudget,
  assertUserMonthlyBudget,
  assertWithinDailyLimit,
  DAILY_LIMITS,
  guardDailyLimit,
  PER_USER_DAILY_USD,
  PER_USER_MONTHLY_USD,
  resetSystemBudgetStateForTests,
  SYSTEM_DAILY_USD,
  secondsUntilUtcMonthStart,
} from "@/lib/usage-limits";

// getPostHogClient is mocked so the shadow-mode isolation test can make capture
// throw. Defaults to null (no-op), matching an unconfigured PostHog.
// captureServerException is a spy so the system-breaker tests can assert the
// loud exception fires.
const { getPostHogClient, captureServerException } = vi.hoisted(() => ({
  getPostHogClient: vi.fn(),
  captureServerException: vi.fn(),
}));
vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => getPostHogClient(),
  captureServerException,
}));

describe("usage-limits integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    // The system-spend cache + alert throttle are module-level; clear them so
    // one test's spend/alert can't leak into the next.
    resetSystemBudgetStateForTests();
    getPostHogClient.mockReset();
    getPostHogClient.mockReturnValue(null);
    captureServerException.mockReset();
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

  test("accrueUsageCost retains sub-cent costs (no rounding to zero)", async () => {
    const user = await createUser();
    // A ~1k-token embedding costs ~$0.00002 — below DECIMAL(10,4)'s resolution.
    await accrueUsageCost(user.id, "ingestion", 0.00002);
    const row = await rowFor(user.id, "ingestion");
    expect(Number(row?.cost_usd)).toBeCloseTo(0.00002, 8);
  });

  describe("guardDailyLimit enforcement", () => {
    const original = process.env.USAGE_LIMITS_ENFORCED;
    afterEach(() => {
      if (original === undefined) delete process.env.USAGE_LIMITS_ENFORCED;
      else process.env.USAGE_LIMITS_ENFORCED = original;
    });

    test("enforced mode blocks with 429 metadata once over the limit", async () => {
      process.env.USAGE_LIMITS_ENFORCED = "true";
      const user = await createUser();
      const limit = DAILY_LIMITS.reanalysis; // 20

      const results = [];
      for (let i = 0; i < limit + 1; i++) {
        results.push(await guardDailyLimit(user.id, "reanalysis"));
      }

      // The first `limit` calls proceed; the guard only blocks the one over.
      expect(
        results.slice(0, limit).every((r) => r.ok && r.action === "allow"),
      ).toBe(true);

      const blocked = results[limit];
      expect(blocked.ok).toBe(false); // route turns this into a 429
      expect(blocked.action).toBe("block");
      expect(blocked.check.count).toBe(limit + 1);
      expect(blocked.check.limit).toBe(limit);
      // Retry-After header value is derived from this — must be positive.
      expect(blocked.check.retryAfterSeconds).toBeGreaterThan(0);
    });

    test("shadow mode (flag unset) keeps allowing past the limit", async () => {
      delete process.env.USAGE_LIMITS_ENFORCED;
      const user = await createUser();
      const limit = DAILY_LIMITS.reanalysis;

      let last: Awaited<ReturnType<typeof guardDailyLimit>> | undefined;
      for (let i = 0; i < limit + 1; i++) {
        last = await guardDailyLimit(user.id, "reanalysis");
      }

      expect(last?.ok).toBe(true); // never blocks in shadow mode
      expect(last?.action).toBe("shadow");
    });
  });

  test("shadow mode never blocks even if analytics capture throws", async () => {
    const user = await createUser();
    const { write } = await import("@/lib/db");
    // Seed the bucket already at its limit so the next guard call is over it.
    await write.$executeRaw`
      INSERT INTO usage_daily (user_id, day, bucket, count, updated_at)
      VALUES (
        ${user.id}::uuid,
        (now() AT TIME ZONE 'utc')::date,
        'reanalysis',
        ${DAILY_LIMITS.reanalysis},
        now()
      )
    `;
    getPostHogClient.mockReturnValueOnce({
      capture: () => {
        throw new Error("posthog down");
      },
    });

    const result = await guardDailyLimit(user.id, "reanalysis");

    expect(result.action).toBe("shadow"); // over limit, not enforced
    expect(result.ok).toBe(true); // shadow mode must not block the request
  });

  describe("assertSystemDailyBudget", () => {
    test("sums cost across all users vs the system cap", async () => {
      const a = await createUser("sys-a@example.com");
      const b = await createUser("sys-b@example.com");
      await accrueUsageCost(a.id, "ingestion", 3.0);
      await accrueUsageCost(b.id, "ingestion", 4.5);

      const budget = await assertSystemDailyBudget();
      expect(budget.spentUsd).toBeCloseTo(7.5, 4);
      expect(budget.limitUsd).toBe(SYSTEM_DAILY_USD);
      expect(budget.underBudget).toBe(true);
    });

    test("flips to over-budget once total spend crosses the cap", async () => {
      const user = await createUser();
      await accrueUsageCost(user.id, "ingestion", SYSTEM_DAILY_USD + 1);

      const budget = await assertSystemDailyBudget();
      expect(budget.underBudget).toBe(false);
    });

    test("reports zero with no usage", async () => {
      const budget = await assertSystemDailyBudget();
      expect(budget.spentUsd).toBe(0);
      expect(budget.underBudget).toBe(true);
    });
  });

  describe("assertUserMonthlyBudget", () => {
    // Seed a cost row on an explicit day/bucket for a user. Uses deterministic
    // month-boundary dates (not "yesterday") so the test can't flake on the 1st.
    const seedCost = async (
      userId: string,
      dayExpr: string,
      bucket: string,
      costUsd: number,
    ) => {
      const { write } = await import("@/lib/db");
      await write.$executeRawUnsafe(
        `INSERT INTO usage_daily (user_id, day, bucket, count, cost_usd, updated_at)
         VALUES ($1::uuid, ${dayExpr}, $2, 0, $3::numeric, now())`,
        userId,
        bucket,
        costUsd,
      );
    };

    const FIRST_OF_MONTH =
      "date_trunc('month', (now() AT TIME ZONE 'utc'))::date";
    const LAST_OF_PREV_MONTH =
      "date_trunc('month', (now() AT TIME ZONE 'utc'))::date - 1";

    test("sums only the current calendar month", async () => {
      const user = await createUser();
      await seedCost(user.id, FIRST_OF_MONTH, "ingestion", 2.0); // in month
      await seedCost(user.id, LAST_OF_PREV_MONTH, "reanalysis", 3.0); // excluded

      const budget = await assertUserMonthlyBudget(user.id);
      expect(budget.spentUsd).toBeCloseTo(2.0, 4);
      expect(budget.limitUsd).toBe(PER_USER_MONTHLY_USD);
      expect(budget.underBudget).toBe(true);
    });

    test("flips to over-budget once month spend crosses the cap", async () => {
      const user = await createUser();
      await seedCost(
        user.id,
        FIRST_OF_MONTH,
        "ingestion",
        PER_USER_MONTHLY_USD + 1,
      );

      const budget = await assertUserMonthlyBudget(user.id);
      expect(budget.underBudget).toBe(false);
    });

    test("reports zero for a user with no usage", async () => {
      const user = await createUser();
      const budget = await assertUserMonthlyBudget(user.id);
      expect(budget.spentUsd).toBe(0);
      expect(budget.underBudget).toBe(true);
    });
  });

  describe("guardDailyLimit — per-user monthly $ cap", () => {
    const original = process.env.USAGE_LIMITS_ENFORCED;
    afterEach(() => {
      if (original === undefined) delete process.env.USAGE_LIMITS_ENFORCED;
      else process.env.USAGE_LIMITS_ENFORCED = original;
    });

    test("enforced: blocks over the monthly cap, with a month-reset Retry-After", async () => {
      process.env.USAGE_LIMITS_ENFORCED = "true";
      const user = await createUser();
      // Over the monthly cap (and incidentally the daily). The monthly gate runs
      // before the daily one, so it's the reason — proving precedence.
      await accrueUsageCost(user.id, "ingestion", PER_USER_MONTHLY_USD + 1);

      const guard = await guardDailyLimit(user.id, "ingestion");
      expect(guard.ok).toBe(false);
      expect(guard.action).toBe("block");
      expect(guard.reason).toBe("user_monthly_budget");
      // Retry-After points at next month, not tomorrow.
      expect(
        Math.abs(guard.check.retryAfterSeconds - secondsUntilUtcMonthStart()),
      ).toBeLessThanOrEqual(2);
    });

    test("shadow: over the monthly cap logs but does not block", async () => {
      delete process.env.USAGE_LIMITS_ENFORCED;
      const user = await createUser();
      await accrueUsageCost(user.id, "ingestion", PER_USER_MONTHLY_USD + 1);

      const guard = await guardDailyLimit(user.id, "ingestion");
      expect(guard.ok).toBe(true);
      expect(guard.action).toBe("shadow");
      expect(guard.reason).toBe("user_monthly_budget");
    });
  });

  describe("guardDailyLimit — per-user $ backstop", () => {
    const original = process.env.USAGE_LIMITS_ENFORCED;
    afterEach(() => {
      if (original === undefined) delete process.env.USAGE_LIMITS_ENFORCED;
      else process.env.USAGE_LIMITS_ENFORCED = original;
    });

    test("enforced: blocks the next action once over the per-user cap", async () => {
      process.env.USAGE_LIMITS_ENFORCED = "true";
      const user = await createUser();
      // Over the daily cap but under the monthly cap and the system breaker, so
      // the daily gate is the one that blocks.
      await accrueUsageCost(user.id, "ingestion", PER_USER_DAILY_USD + 0.5);

      const guard = await guardDailyLimit(user.id, "ingestion");
      expect(guard.ok).toBe(false);
      expect(guard.action).toBe("block");
      expect(guard.reason).toBe("user_daily_budget");
      // Count still positive → the 429 carries a valid Retry-After.
      expect(guard.check.retryAfterSeconds).toBeGreaterThan(0);
    });

    test("shadow: over the per-user cap logs but does not block", async () => {
      delete process.env.USAGE_LIMITS_ENFORCED;
      const user = await createUser();
      await accrueUsageCost(user.id, "ingestion", PER_USER_DAILY_USD + 0.5);

      const guard = await guardDailyLimit(user.id, "ingestion");
      expect(guard.ok).toBe(true);
      expect(guard.action).toBe("shadow");
      expect(guard.reason).toBe("user_daily_budget");
    });

    test("under the per-user cap allows cleanly", async () => {
      process.env.USAGE_LIMITS_ENFORCED = "true";
      const user = await createUser();
      await accrueUsageCost(user.id, "ingestion", PER_USER_DAILY_USD - 0.5);

      const guard = await guardDailyLimit(user.id, "ingestion");
      expect(guard.ok).toBe(true);
      expect(guard.action).toBe("allow");
      expect(guard.reason).toBeUndefined();
    });
  });

  describe("guardDailyLimit — system $ circuit-breaker", () => {
    const original = process.env.USAGE_LIMITS_ENFORCED;
    afterEach(() => {
      if (original === undefined) delete process.env.USAGE_LIMITS_ENFORCED;
      else process.env.USAGE_LIMITS_ENFORCED = original;
    });

    test("enforced: halts a new action globally + fires the loud alert", async () => {
      process.env.USAGE_LIMITS_ENFORCED = "true";
      const capture = vi.fn();
      getPostHogClient.mockReturnValue({ capture });

      // A different user drains the wallet; the acting user is under their own cap.
      const spender = await createUser("spender@example.com");
      await accrueUsageCost(spender.id, "ingestion", SYSTEM_DAILY_USD + 5);

      const actor = await createUser("actor@example.com");
      const guard = await guardDailyLimit(actor.id, "ingestion");

      expect(guard.ok).toBe(false);
      expect(guard.action).toBe("block");
      expect(guard.reason).toBe("system_budget");
      // Loud signal: PostHog event + captured exception.
      expect(capture).toHaveBeenCalledWith(
        expect.objectContaining({ event: "system_daily_budget_exceeded" }),
      );
      expect(captureServerException).toHaveBeenCalledTimes(1);
    });

    test("shadow: over the breaker logs the loud signal but does not block", async () => {
      delete process.env.USAGE_LIMITS_ENFORCED;
      const capture = vi.fn();
      getPostHogClient.mockReturnValue({ capture });

      const spender = await createUser("spender2@example.com");
      await accrueUsageCost(spender.id, "ingestion", SYSTEM_DAILY_USD + 5);

      const actor = await createUser("actor2@example.com");
      const guard = await guardDailyLimit(actor.id, "ingestion");

      expect(guard.ok).toBe(true);
      expect(guard.action).toBe("shadow");
      expect(guard.reason).toBe("system_budget");
      expect(captureServerException).toHaveBeenCalledTimes(1);
    });

    test("throttles the loud alert across repeated breached calls", async () => {
      process.env.USAGE_LIMITS_ENFORCED = "true";
      const capture = vi.fn();
      getPostHogClient.mockReturnValue({ capture });

      const spender = await createUser("spender3@example.com");
      await accrueUsageCost(spender.id, "ingestion", SYSTEM_DAILY_USD + 5);

      const actor = await createUser("actor3@example.com");
      await guardDailyLimit(actor.id, "ingestion");
      await guardDailyLimit(actor.id, "ingestion");
      await guardDailyLimit(actor.id, "ingestion");

      // Within one cache window the loud alert fires exactly once, not per call.
      expect(captureServerException).toHaveBeenCalledTimes(1);
      expect(
        capture.mock.calls.filter(
          ([e]) => e.event === "system_daily_budget_exceeded",
        ),
      ).toHaveLength(1);
    });
  });
});
