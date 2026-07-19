import { describe, expect, it } from "vitest";
import { findDateExpressions } from "./parse-date-expression";

// Fixed "now" so relative phrases are deterministic: 19 July 2026 (UTC).
const NOW = new Date(Date.UTC(2026, 6, 19));

describe("findDateExpressions", () => {
  it("parses month + year as a whole-month range", () => {
    const [m] = findDateExpressions("trip june 2026", NOW);
    expect(m).toMatchObject({
      value: "2026-06-01",
      endDate: "2026-06-30",
      operator: "between",
    });
    expect("trip june 2026".slice(m.start, m.end)).toBe("june 2026");
  });

  it("parses an ISO date as a single day", () => {
    const [m] = findDateExpressions("saved 2026-06-15", NOW);
    expect(m).toMatchObject({ value: "2026-06-15", operator: "is" });
    expect(m.endDate).toBeUndefined();
  });

  it("parses a bare year as a whole year", () => {
    const [m] = findDateExpressions("2026 photos", NOW);
    expect(m).toMatchObject({
      value: "2026-01-01",
      endDate: "2026-12-31",
      operator: "between",
    });
  });

  it("does not double-match the year inside 'june 2026'", () => {
    expect(findDateExpressions("june 2026", NOW)).toHaveLength(1);
  });

  it("does not match the year inside an ISO date", () => {
    expect(findDateExpressions("2026-06-15", NOW)).toHaveLength(1);
  });

  it("resolves relative phrases against the injected now", () => {
    expect(findDateExpressions("today", NOW)[0]).toMatchObject({
      value: "2026-07-19",
      operator: "is",
    });
    expect(findDateExpressions("yesterday", NOW)[0]).toMatchObject({
      value: "2026-07-18",
      operator: "is",
    });
    expect(findDateExpressions("this month", NOW)[0]).toMatchObject({
      value: "2026-07-01",
      endDate: "2026-07-31",
    });
    expect(findDateExpressions("last month", NOW)[0]).toMatchObject({
      value: "2026-06-01",
      endDate: "2026-06-30",
    });
    expect(findDateExpressions("this year", NOW)[0]).toMatchObject({
      value: "2026-01-01",
      endDate: "2026-12-31",
    });
    expect(findDateExpressions("last year", NOW)[0]).toMatchObject({
      value: "2025-01-01",
      endDate: "2025-12-31",
    });
  });

  it("rolls last month back across a year boundary", () => {
    const jan = new Date(Date.UTC(2026, 0, 10));
    expect(findDateExpressions("last month", jan)[0]).toMatchObject({
      value: "2025-12-01",
      endDate: "2025-12-31",
    });
  });

  it("returns nothing for text with no dates", () => {
    expect(findDateExpressions("orange armchair", NOW)).toEqual([]);
  });
});
