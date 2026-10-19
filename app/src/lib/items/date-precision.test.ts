import { describe, expect, it } from "vitest";
import {
  endOfPrecision,
  formatPublicReadingDate,
  startOfPrecision,
} from "./date-precision";

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

  it("returns the end of the last day of the month for month precision", () => {
    expect(endOfPrecision(new Date(Date.UTC(2026, 1, 1)), "month")).toEqual(
      new Date(Date.UTC(2026, 1, 28, 23, 59, 59, 999)),
    );
  });

  it("returns the end of Dec 31 for year precision", () => {
    expect(endOfPrecision(new Date(Date.UTC(2026, 0, 1)), "year")).toEqual(
      new Date(Date.UTC(2026, 11, 31, 23, 59, 59, 999)),
    );
  });
});

describe("formatPublicReadingDate", () => {
  it("recovers a calendar pick made east of UTC (local midnight the day before in UTC)", () => {
    // Oct 19 picked in London (BST): local midnight is 23:00 UTC on Oct 18
    expect(formatPublicReadingDate("2026-10-18T23:00:00.000Z", "day")).toBe(
      "Oct 19, 2026",
    );
    // Oct 19 picked in Kolkata (UTC+5:30)
    expect(formatPublicReadingDate("2026-10-18T18:30:00.000Z", "day")).toBe(
      "Oct 19, 2026",
    );
  });

  it("recovers a calendar pick made west of UTC", () => {
    // Oct 19 picked in San Francisco (PDT): local midnight is 07:00 UTC
    expect(formatPublicReadingDate("2026-10-19T07:00:00.000Z", "day")).toBe(
      "Oct 19, 2026",
    );
    expect(formatPublicReadingDate("2026-10-19T12:00:00.000Z", "day")).toBe(
      "Oct 19, 2026",
    );
  });

  it("reads a Today tap (a real moment) in UTC", () => {
    expect(formatPublicReadingDate("2026-10-19T21:22:13.512Z", "day")).toBe(
      "Oct 19, 2026",
    );
  });

  it("leaves month and year dates to formatReadingDate", () => {
    expect(formatPublicReadingDate("2023-11-01T00:00:00.000Z", "month")).toBe(
      "Nov 2023",
    );
    expect(formatPublicReadingDate("2023-01-01T00:00:00.000Z", "year")).toBe(
      "2023",
    );
  });
});
