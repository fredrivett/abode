import { BookProgressUnit, BookReadingStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  BOOK_READING_STATUS_LABELS,
  bookReadingSchema,
  isReadingDateRangeInverted,
} from "./book-reading-status";

describe("isReadingDateRangeInverted", () => {
  it("is false when either date is missing", () => {
    expect(isReadingDateRangeInverted(null, new Date(), "day")).toBe(false);
    expect(isReadingDateRangeInverted(new Date(), null, "day")).toBe(false);
  });

  it("is true for a same-precision inverted pair", () => {
    expect(
      isReadingDateRangeInverted(
        new Date("2026-08-01"),
        new Date("2026-07-01"),
        "day",
      ),
    ).toBe(true);
  });

  it("is false for an overlapping coarse-precision pair", () => {
    // Started March 2020 (month), finished sometime in 2020 (year) — not
    // provably inverted.
    expect(
      isReadingDateRangeInverted(
        new Date(Date.UTC(2020, 2, 1)),
        new Date(Date.UTC(2020, 0, 1)),
        "year",
      ),
    ).toBe(false);
  });

  it("is true when the finished period ends before the started period starts", () => {
    // Started March 2020, finished sometime in 2019 — every day in 2019 is
    // before March 2020.
    expect(
      isReadingDateRangeInverted(
        new Date(Date.UTC(2020, 2, 1)),
        new Date(Date.UTC(2019, 0, 1)),
        "year",
      ),
    ).toBe(true);
  });

  it("is false for an exact same-day started time on the coarse period's final day", () => {
    // Finished sometime in August 2026 (month precision, normalized to Aug 1
    // midnight); started at an exact, non-midnight time on Aug 31 — the last
    // day of that month. The finished period must be treated as extending to
    // the END of Aug 31, not midnight at its start, or this exact-time
    // startedAt would wrongly appear to be after it.
    expect(
      isReadingDateRangeInverted(
        new Date(Date.UTC(2026, 7, 31, 14, 30)),
        new Date(Date.UTC(2026, 7, 1)),
        "month",
      ),
    ).toBe(false);
  });
});

describe("BOOK_READING_STATUS_LABELS", () => {
  it("has a label for every reading status", () => {
    for (const status of Object.values(BookReadingStatus)) {
      expect(BOOK_READING_STATUS_LABELS[status]).toBeTruthy();
    }
  });
});

describe("bookReadingSchema", () => {
  it("accepts a full valid patch and coerces ISO date strings to Date", () => {
    const parsed = bookReadingSchema.parse({
      status: BookReadingStatus.reading,
      startedAt: "2026-07-01T00:00:00.000Z",
      finishedAt: "2026-08-01T00:00:00.000Z",
      progressValue: 143,
      progressUnit: BookProgressUnit.page,
      rating: 9,
    });
    expect(parsed.startedAt).toBeInstanceOf(Date);
    expect(parsed.finishedAt).toBeInstanceOf(Date);
  });

  it("accepts an empty patch (every field optional)", () => {
    expect(bookReadingSchema.parse({})).toEqual({});
  });

  it("allows null to clear a field", () => {
    expect(
      bookReadingSchema.parse({ status: null, rating: null }).rating,
    ).toBeNull();
  });

  it("rejects an unknown status", () => {
    expect(bookReadingSchema.safeParse({ status: "abandoned" }).success).toBe(
      false,
    );
  });

  it("rejects a rating outside 1..10", () => {
    expect(bookReadingSchema.safeParse({ rating: 0 }).success).toBe(false);
    expect(bookReadingSchema.safeParse({ rating: 11 }).success).toBe(false);
    expect(bookReadingSchema.safeParse({ rating: 4.5 }).success).toBe(false);
  });

  it("rejects a negative page value", () => {
    expect(bookReadingSchema.safeParse({ progressValue: -1 }).success).toBe(
      false,
    );
  });

  it("rejects percent progress above 100", () => {
    expect(
      bookReadingSchema.safeParse({
        progressUnit: BookProgressUnit.percent,
        progressValue: 150,
      }).success,
    ).toBe(false);
  });

  it("allows a large page value above 100 (page mode, no percent ceiling)", () => {
    expect(
      bookReadingSchema.safeParse({
        progressUnit: BookProgressUnit.page,
        progressValue: 512,
      }).success,
    ).toBe(true);
  });

  it("rejects a finished date before the started date", () => {
    expect(
      bookReadingSchema.safeParse({
        startedAt: "2026-08-01T00:00:00.000Z",
        finishedAt: "2026-07-01T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("allows finishedAt with no startedAt (back-dated read)", () => {
    expect(
      bookReadingSchema.safeParse({
        status: BookReadingStatus.read,
        finishedAt: "2026-07-01T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("defaults to day precision (unchanged) when no precision is sent", () => {
    const parsed = bookReadingSchema.parse({
      startedAt: "2026-07-15T00:00:00.000Z",
    });
    expect(parsed.startedAtPrecision).toBe("day");
    expect(parsed.startedAt).toEqual(new Date("2026-07-15T00:00:00.000Z"));
  });

  it("normalizes a month-precision date to the 1st of the month", () => {
    const parsed = bookReadingSchema.parse({
      startedAt: "2026-07-15T00:00:00.000Z",
      startedAtPrecision: "month",
    });
    expect(parsed.startedAt).toEqual(new Date(Date.UTC(2026, 6, 1)));
  });

  it("normalizes a year-precision date to Jan 1", () => {
    const parsed = bookReadingSchema.parse({
      finishedAt: "2019-07-15T00:00:00.000Z",
      finishedAtPrecision: "year",
    });
    expect(parsed.finishedAt).toEqual(new Date(Date.UTC(2019, 0, 1)));
  });

  it("clears precision alongside the date when clearing a field", () => {
    const parsed = bookReadingSchema.parse({ startedAt: null });
    expect(parsed.startedAt).toBeNull();
    expect(parsed.startedAtPrecision).toBeNull();
  });

  it("rejects startedAtPrecision sent without startedAt", () => {
    expect(
      bookReadingSchema.safeParse({ startedAtPrecision: "month" }).success,
    ).toBe(false);
  });

  it("rejects finishedAtPrecision sent without finishedAt", () => {
    expect(
      bookReadingSchema.safeParse({ finishedAtPrecision: "year" }).success,
    ).toBe(false);
  });

  it("allows an overlapping coarse-precision pair that isn't provably inverted", () => {
    // Started March 2020 (month), finished sometime in 2020 (year) — the
    // finished year could plausibly be after March, so this must not be
    // rejected just because Jan 1 < Mar 1.
    expect(
      bookReadingSchema.safeParse({
        startedAt: "2020-03-01T00:00:00.000Z",
        startedAtPrecision: "month",
        finishedAt: "2020-01-01T00:00:00.000Z",
        finishedAtPrecision: "year",
      }).success,
    ).toBe(true);
  });

  it("rejects a coarse-precision pair that is provably inverted", () => {
    // Started March 2020, finished sometime in 2019 — every possible day in
    // 2019 is before March 2020.
    expect(
      bookReadingSchema.safeParse({
        startedAt: "2020-03-01T00:00:00.000Z",
        startedAtPrecision: "month",
        finishedAt: "2019-06-01T00:00:00.000Z",
        finishedAtPrecision: "year",
      }).success,
    ).toBe(false);
  });
});
