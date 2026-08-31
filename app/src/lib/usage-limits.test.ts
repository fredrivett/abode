import { afterEach, describe, expect, it } from "vitest";
import {
  DAILY_LIMITS,
  isUsageLimitsEnforced,
  PER_USER_DAILY_USD,
  PER_USER_MONTHLY_USD,
  perUserDailyUsdLimit,
  perUserMonthlyUsdLimit,
  resolveGuardAction,
  SYSTEM_DAILY_USD,
  secondsUntilUtcMidnight,
  secondsUntilUtcMonthStart,
  shouldWarnShadowMode,
  startOfUtcDay,
  systemDailyUsdLimit,
} from "./usage-limits";

describe("DAILY_LIMITS", () => {
  it("maps each bucket to its configured limit", () => {
    expect(DAILY_LIMITS.ingestion).toBe(150);
    expect(DAILY_LIMITS.reanalysis).toBe(20);
    expect(DAILY_LIMITS.location).toBe(150);
    expect(DAILY_LIMITS.search).toBe(500);
    expect(DAILY_LIMITS.emoji).toBe(180);
  });

  it("exposes the $ backstops", () => {
    expect(PER_USER_DAILY_USD).toBe(2.0);
    expect(PER_USER_MONTHLY_USD).toBe(5.0);
    expect(SYSTEM_DAILY_USD).toBe(10.0);
  });
});

describe("secondsUntilUtcMidnight", () => {
  it("counts down to the next UTC midnight", () => {
    // 23:00 UTC → one hour to midnight
    expect(secondsUntilUtcMidnight(new Date("2026-07-27T23:00:00.000Z"))).toBe(
      3600,
    );
    // Exactly midnight → a full day to the NEXT midnight
    expect(secondsUntilUtcMidnight(new Date("2026-07-27T00:00:00.000Z"))).toBe(
      86400,
    );
    // Midday → half a day
    expect(secondsUntilUtcMidnight(new Date("2026-07-27T12:00:00.000Z"))).toBe(
      43200,
    );
  });

  it("never returns less than one second", () => {
    // 1ms before midnight → clamped to 1, so Retry-After is never 0
    expect(secondsUntilUtcMidnight(new Date("2026-07-27T23:59:59.999Z"))).toBe(
      1,
    );
  });
});

describe("secondsUntilUtcMonthStart", () => {
  it("counts down to the first of the next UTC month", () => {
    // 1 day before Feb 1 → 86400s
    expect(
      secondsUntilUtcMonthStart(new Date("2026-01-31T00:00:00.000Z")),
    ).toBe(86400);
    // Exactly the 1st at midnight → a full month to the NEXT 1st (Feb has 28d)
    expect(
      secondsUntilUtcMonthStart(new Date("2026-02-01T00:00:00.000Z")),
    ).toBe(28 * 86400);
  });

  it("rolls over the year at December", () => {
    // Dec 31 → Jan 1 next year, one day away
    expect(
      secondsUntilUtcMonthStart(new Date("2026-12-31T00:00:00.000Z")),
    ).toBe(86400);
  });

  it("never returns less than one second", () => {
    expect(
      secondsUntilUtcMonthStart(new Date("2026-03-31T23:59:59.999Z")),
    ).toBe(1);
  });
});

describe("startOfUtcDay", () => {
  it("returns UTC midnight for the given instant", () => {
    expect(
      startOfUtcDay(new Date("2026-07-27T13:45:12.500Z")).toISOString(),
    ).toBe("2026-07-27T00:00:00.000Z");
  });

  it("uses the UTC date, not local time", () => {
    expect(
      startOfUtcDay(new Date("2026-07-28T00:30:00.000Z")).toISOString(),
    ).toBe("2026-07-28T00:00:00.000Z");
  });
});

describe("resolveGuardAction", () => {
  it("allows whenever within limit, regardless of enforcement", () => {
    expect(resolveGuardAction(true, true)).toBe("allow");
    expect(resolveGuardAction(true, false)).toBe("allow");
  });

  it("blocks an over-limit action only when enforced", () => {
    expect(resolveGuardAction(false, true)).toBe("block");
  });

  it("shadows (does not block) an over-limit action when not enforced", () => {
    expect(resolveGuardAction(false, false)).toBe("shadow");
  });

  // The $ gates reuse resolveGuardAction with `underBudget` as the `allowed`
  // input, so this same matrix is the budget-gate decision for both scopes:
  // under-budget → allow; over-budget → block (enforced) / shadow (not).
  it("decides the $ budget gates: over-budget blocks only when enforced", () => {
    const underBudget = false; // spend crossed the cap
    expect(resolveGuardAction(underBudget, true)).toBe("block");
    expect(resolveGuardAction(underBudget, false)).toBe("shadow");
    expect(resolveGuardAction(true, true)).toBe("allow");
    expect(resolveGuardAction(true, false)).toBe("allow");
  });
});

describe("shouldWarnShadowMode", () => {
  it("warns once when unprotected: not yet warned and not enforced", () => {
    expect(shouldWarnShadowMode(false, false)).toBe(true);
  });

  it("does not warn once already warned this process", () => {
    expect(shouldWarnShadowMode(true, false)).toBe(false);
  });

  it("does not warn when enforcement is on", () => {
    expect(shouldWarnShadowMode(false, true)).toBe(false);
    expect(shouldWarnShadowMode(true, true)).toBe(false);
  });
});

describe("perUserDailyUsdLimit / perUserMonthlyUsdLimit / systemDailyUsdLimit", () => {
  const originalDaily = process.env.PER_USER_DAILY_USD;
  const originalMonthly = process.env.PER_USER_MONTHLY_USD;
  const originalSystem = process.env.SYSTEM_DAILY_USD;

  afterEach(() => {
    if (originalDaily === undefined) delete process.env.PER_USER_DAILY_USD;
    else process.env.PER_USER_DAILY_USD = originalDaily;
    if (originalMonthly === undefined) delete process.env.PER_USER_MONTHLY_USD;
    else process.env.PER_USER_MONTHLY_USD = originalMonthly;
    if (originalSystem === undefined) delete process.env.SYSTEM_DAILY_USD;
    else process.env.SYSTEM_DAILY_USD = originalSystem;
  });

  it("falls back to the compiled default when unset", () => {
    delete process.env.PER_USER_DAILY_USD;
    delete process.env.PER_USER_MONTHLY_USD;
    delete process.env.SYSTEM_DAILY_USD;
    expect(perUserDailyUsdLimit()).toBe(PER_USER_DAILY_USD);
    expect(perUserMonthlyUsdLimit()).toBe(PER_USER_MONTHLY_USD);
    expect(systemDailyUsdLimit()).toBe(SYSTEM_DAILY_USD);
  });

  it("uses a positive numeric override", () => {
    process.env.PER_USER_DAILY_USD = "1";
    process.env.PER_USER_MONTHLY_USD = "3";
    process.env.SYSTEM_DAILY_USD = "20";
    expect(perUserDailyUsdLimit()).toBe(1);
    expect(perUserMonthlyUsdLimit()).toBe(3);
    expect(systemDailyUsdLimit()).toBe(20);
  });

  it("ignores blank / non-numeric / non-positive overrides (keeps the default)", () => {
    for (const bad of ["", "abc", "0", "-1", "NaN"]) {
      process.env.PER_USER_DAILY_USD = bad;
      process.env.PER_USER_MONTHLY_USD = bad;
      process.env.SYSTEM_DAILY_USD = bad;
      expect(perUserDailyUsdLimit()).toBe(PER_USER_DAILY_USD);
      expect(perUserMonthlyUsdLimit()).toBe(PER_USER_MONTHLY_USD);
      expect(systemDailyUsdLimit()).toBe(SYSTEM_DAILY_USD);
    }
  });
});

describe("isUsageLimitsEnforced", () => {
  const originalFlag = process.env.USAGE_LIMITS_ENFORCED;
  const originalNodeEnv = process.env.NODE_ENV;

  const setNodeEnv = (value: string) => {
    // NODE_ENV is typed readonly; the cast is only for the test override.
    (process.env as { NODE_ENV?: string }).NODE_ENV = value;
  };

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.USAGE_LIMITS_ENFORCED;
    else process.env.USAGE_LIMITS_ENFORCED = originalFlag;
    setNodeEnv(originalNodeEnv ?? "test");
  });

  it('an explicit "true" enforces regardless of environment', () => {
    process.env.USAGE_LIMITS_ENFORCED = "true";
    setNodeEnv("development");
    expect(isUsageLimitsEnforced()).toBe(true);
  });

  it('an explicit "false" opts out even in production', () => {
    process.env.USAGE_LIMITS_ENFORCED = "false";
    setNodeEnv("production");
    expect(isUsageLimitsEnforced()).toBe(false);
  });

  it("unset → enforces on a built/deployed env (NODE_ENV=production)", () => {
    delete process.env.USAGE_LIMITS_ENFORCED;
    setNodeEnv("production");
    expect(isUsageLimitsEnforced()).toBe(true);
  });

  it("unset → shadow in local dev / tests", () => {
    delete process.env.USAGE_LIMITS_ENFORCED;
    setNodeEnv("development");
    expect(isUsageLimitsEnforced()).toBe(false);
    setNodeEnv("test");
    expect(isUsageLimitsEnforced()).toBe(false);
  });

  it("only the exact strings drive the explicit override (else env-default)", () => {
    setNodeEnv("development"); // so the env-default is shadow
    for (const notTrue of ["1", "yes", "TRUE"]) {
      process.env.USAGE_LIMITS_ENFORCED = notTrue;
      expect(isUsageLimitsEnforced()).toBe(false);
    }
  });
});
