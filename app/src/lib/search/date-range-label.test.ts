import { describe, expect, it } from "vitest";
import { collapseDateRange } from "./date-range-label";

describe("collapseDateRange", () => {
  it("collapses a whole month to 'Month Year'", () => {
    expect(collapseDateRange("2026-06-01", "2026-06-30")).toBe("June 2026");
  });

  it("collapses a whole year to 'Year'", () => {
    expect(collapseDateRange("2026-01-01", "2026-12-31")).toBe("2026");
  });

  it("collapses whole multi-year spans to 'Year – Year'", () => {
    expect(collapseDateRange("2025-01-01", "2026-12-31")).toBe("2025 – 2026");
  });

  it("collapses whole month spans within a year", () => {
    expect(collapseDateRange("2026-06-01", "2026-08-31")).toBe(
      "June – August 2026",
    );
  });

  it("collapses whole month spans across years", () => {
    expect(collapseDateRange("2025-06-01", "2026-02-28")).toBe(
      "June 2025 – February 2026",
    );
  });

  it("handles February in a leap year", () => {
    expect(collapseDateRange("2028-02-01", "2028-02-29")).toBe("February 2028");
  });

  it("returns null when the start is not the 1st", () => {
    expect(collapseDateRange("2026-06-05", "2026-06-30")).toBeNull();
  });

  it("returns null when the end is not the last day of its month", () => {
    expect(collapseDateRange("2026-06-01", "2026-06-15")).toBeNull();
  });

  it("returns null for non-ISO or empty values", () => {
    expect(collapseDateRange("june 2026", "")).toBeNull();
    expect(collapseDateRange("", "")).toBeNull();
  });
});
