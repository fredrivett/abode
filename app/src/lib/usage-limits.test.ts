import { afterEach, describe, expect, it } from "vitest";
import {
  DAILY_LIMITS,
  isUsageLimitsEnforced,
  PER_USER_DAILY_USD,
  resolveGuardAction,
  SYSTEM_DAILY_USD,
  secondsUntilUtcMidnight,
  startOfUtcDay,
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
    expect(SYSTEM_DAILY_USD).toBe(50.0);
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
});

describe("isUsageLimitsEnforced", () => {
  const original = process.env.USAGE_LIMITS_ENFORCED;
  afterEach(() => {
    if (original === undefined) delete process.env.USAGE_LIMITS_ENFORCED;
    else process.env.USAGE_LIMITS_ENFORCED = original;
  });

  it('is true only for the exact string "true"', () => {
    process.env.USAGE_LIMITS_ENFORCED = "true";
    expect(isUsageLimitsEnforced()).toBe(true);
  });

  it("defaults to false when unset (shadow mode)", () => {
    delete process.env.USAGE_LIMITS_ENFORCED;
    expect(isUsageLimitsEnforced()).toBe(false);
  });

  it("is false for any other truthy-looking value", () => {
    process.env.USAGE_LIMITS_ENFORCED = "1";
    expect(isUsageLimitsEnforced()).toBe(false);
    process.env.USAGE_LIMITS_ENFORCED = "yes";
    expect(isUsageLimitsEnforced()).toBe(false);
    process.env.USAGE_LIMITS_ENFORCED = "TRUE";
    expect(isUsageLimitsEnforced()).toBe(false);
  });
});
