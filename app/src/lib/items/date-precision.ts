import { format } from "date-fns";
import { z } from "zod";

// Precision at which a started/finished reading date is known. Mirrors the
// Prisma DatePrecision enum but declared here so callers don't need
// @prisma/client just for this string union.
export const DATE_PRECISIONS = ["day", "month", "year"] as const;
export type DatePrecisionValue = (typeof DATE_PRECISIONS)[number];

export const datePrecisionSchema = z.enum(DATE_PRECISIONS);

export const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Formats a stored date per its precision. Month/year read from UTC fields
// (they're always normalized to a UTC period start) so display can't drift
// across a month/year boundary depending on the viewer's local timezone; day
// precision keeps the local-time `format` call unchanged.
export function formatReadingDate(
  iso: string,
  precision: DatePrecisionValue,
): string {
  const date = new Date(iso);
  if (precision === "year") return String(date.getUTCFullYear());
  if (precision === "month")
    return `${MONTH_LABELS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  return format(date, "d MMM yyyy");
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * {@link formatReadingDate} for anyone but the owner, in any timezone (public
 * pages, share cards rendered on the server). A day date is stored as the
 * instant the owner picked — local midnight from the calendar, or the moment
 * they tapped Today — so reading it in another timezone can land on the wrong
 * day. A calendar pick (whole minutes, no seconds) lies within ±12h of its
 * date's UTC midnight, so it rounds to the nearest; a Today tap is a real
 * moment, best read in UTC. Deterministic, so server and client agree.
 */
export function formatPublicReadingDate(
  iso: string,
  precision: DatePrecisionValue,
): string {
  if (precision !== "day") return formatReadingDate(iso, precision);
  const date = new Date(iso);
  const isCalendarPick =
    date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
  // Past noon UTC means the next day's midnight is nearer (noon itself stays)
  const sinceMidnight =
    date.getTime() - Math.floor(date.getTime() / DAY_MS) * DAY_MS;
  const day =
    isCalendarPick && sinceMidnight > DAY_MS / 2
      ? new Date(date.getTime() + DAY_MS)
      : date;
  return `${day.getUTCDate()} ${MONTH_LABELS[day.getUTCMonth()]} ${day.getUTCFullYear()}`;
}

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
// normalized to the start of that period. Must land at 23:59:59.999 on the
// final day, not midnight — day precision isn't truncated, so an exact
// same-day time would otherwise compare as after it.
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
          23,
          59,
          59,
          999,
        ),
      );
    case "year":
      return new Date(
        Date.UTC(normalizedStart.getUTCFullYear(), 11, 31, 23, 59, 59, 999),
      );
  }
}
