import { z } from "zod";

// Precision at which a started/finished reading date is known. Mirrors the
// Prisma DatePrecision enum but declared here so callers don't need
// @prisma/client just for this string union.
export const DATE_PRECISIONS = ["day", "month", "year"] as const;
export type DatePrecisionValue = (typeof DATE_PRECISIONS)[number];

export const datePrecisionSchema = z.enum(DATE_PRECISIONS);

// Truncate to the start of the period implied by precision, in UTC, so the
// stored instant is stable regardless of caller timezone. Day precision is
// never truncated here — it's passed through as the exact instant the caller
// sent, matching pre-partial-date-support behavior.
export function startOfPrecision(
  date: Date,
  precision: DatePrecisionValue,
): Date {
  switch (precision) {
    case "day":
      return date;
    case "month":
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    case "year":
      return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  }
}

// Latest instant still within the known period, given a date already
// normalized to the start of that period. Used to check whether a
// start/finish pair is *possibly* valid without over-rejecting coarse dates —
// e.g. "started March 2020" / "finished 2020" isn't provably inverted.
export function endOfPrecision(
  normalizedStart: Date,
  precision: DatePrecisionValue,
): Date {
  switch (precision) {
    case "day":
      return normalizedStart;
    case "month":
      return new Date(
        Date.UTC(
          normalizedStart.getUTCFullYear(),
          normalizedStart.getUTCMonth() + 1,
          0,
        ),
      );
    case "year":
      return new Date(Date.UTC(normalizedStart.getUTCFullYear(), 11, 31));
  }
}
