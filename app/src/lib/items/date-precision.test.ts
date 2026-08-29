import { describe, expect, it } from "vitest";
import { endOfPrecision, startOfPrecision } from "./date-precision";

describe("startOfPrecision", () => {
  it("passes a day-precision date through unchanged", () => {
    const date = new Date("2026-07-15T08:30:00.000Z");
    expect(startOfPrecision(date, "day")).toBe(date);
  });

  it("truncates a month-precision date to the 1st", () => {
    const date = new Date(Date.UTC(2026, 6, 15, 8, 30));
    expect(startOfPrecision(date, "month")).toEqual(
      new Date(Date.UTC(2026, 6, 1)),
    );
  });

  it("truncates a year-precision date to Jan 1", () => {
    const date = new Date(Date.UTC(2026, 6, 15, 8, 30));
    expect(startOfPrecision(date, "year")).toEqual(
      new Date(Date.UTC(2026, 0, 1)),
    );
  });
});

describe("endOfPrecision", () => {
  it("returns the same instant for day precision", () => {
    const date = new Date(Date.UTC(2026, 6, 15));
    expect(endOfPrecision(date, "day")).toEqual(date);
  });

  it("returns the last day of the month for month precision", () => {
    expect(endOfPrecision(new Date(Date.UTC(2026, 1, 1)), "month")).toEqual(
      new Date(Date.UTC(2026, 1, 28)),
    );
  });

  it("returns Dec 31 for year precision", () => {
    expect(endOfPrecision(new Date(Date.UTC(2026, 0, 1)), "year")).toEqual(
      new Date(Date.UTC(2026, 11, 31)),
    );
  });
});
