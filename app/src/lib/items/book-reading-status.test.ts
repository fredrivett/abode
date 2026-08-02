import { BookProgressUnit, BookReadingStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  BOOK_READING_STATUS_LABELS,
  bookReadingSchema,
} from "./book-reading-status";

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
});
