import { BookProgressUnit, BookReadingStatus } from "@prisma/client";
import { z } from "zod";
import {
  type DatePrecisionValue,
  datePrecisionSchema,
  endOfPrecision,
  startOfPrecision,
} from "@/lib/items/date-precision";
import type { BookDetails } from "@/lib/types/item";

// Reading fields in their "not tracked" state. Used by read paths that don't
// (yet) surface per-user reading state — public shelves must not leak the
// owner's private reading status, and search-result cards don't render it.
export const UNTRACKED_BOOK_READING: Pick<
  BookDetails,
  | "status"
  | "startedAt"
  | "startedAtPrecision"
  | "finishedAt"
  | "finishedAtPrecision"
  | "progressValue"
  | "progressUnit"
  | "progressUpdatedAt"
  | "rating"
> = {
  status: null,
  startedAt: null,
  startedAtPrecision: null,
  finishedAt: null,
  finishedAtPrecision: null,
  progressValue: null,
  progressUnit: "page",
  progressUpdatedAt: null,
  rating: null,
};

// Normalizes a date + optional precision to a start-of-period instant plus a
// definite precision. undefined date => field wasn't touched (undefined
// passes through unchanged so callers can tell "not sent" from "cleared").
function normalizeDateField(
  date: Date | null | undefined,
  precision: DatePrecisionValue | null | undefined,
): {
  date: Date | null | undefined;
  precision: DatePrecisionValue | null | undefined;
} {
  if (date === undefined) return { date: undefined, precision: undefined };
  if (date === null) return { date: null, precision: null };
  const effectivePrecision = precision ?? "day";
  return {
    date: startOfPrecision(date, effectivePrecision),
    precision: effectivePrecision,
  };
}

// Whether a started/finished pair is provably inverted — i.e. every possible
// instant in the finished period is before the started period. Coarse
// precisions overlap rather than compare exactly (e.g. "started March 2020" /
// "finished 2020" isn't inverted, since the finish could plausibly land after
// March), so this compares the *latest* possible finished instant against the
// *earliest* possible started instant. Shared by the in-request schema refine
// and the route's merge-with-stored-values check.
export function isReadingDateRangeInverted(
  startedAt: Date | null,
  finishedAt: Date | null,
  finishedAtPrecision: DatePrecisionValue,
): boolean {
  return Boolean(
    startedAt &&
      finishedAt &&
      endOfPrecision(finishedAt, finishedAtPrecision) < startedAt,
  );
}

// Human-readable labels for each reading status. Vocabulary is book-specific —
// other item kinds (e.g. movies) get their own status enum + labels rather than
// sharing a cross-kind status. Completeness is asserted in the colocated test.
export const BOOK_READING_STATUS_LABELS: Record<BookReadingStatus, string> = {
  want_to_read: "Want to read",
  reading: "Reading",
  read: "Read",
  dnf: "Did not finish",
};

// Rating is stored on a /10 scale so half-stars are expressible (1..10 => 0.5..5
// stars); null means unrated.
export const MIN_BOOK_RATING = 1;
export const MAX_BOOK_RATING = 10;

// Percent progress bounds (page bounds aren't checked here — pageCount may be
// unknown, so an upper bound can't be enforced at validation time).
export const MIN_PERCENT = 0;
export const MAX_PERCENT = 100;

// Per-kind (book) validation for the reading-lifecycle fields sent in an item
// PATCH body. Grouped under `bookReading` so the route can route it straight to
// the itemBookDetails write. Every field is optional so callers can patch a
// single field; null explicitly clears a value.
export const bookReadingSchema = z
  .object({
    status: z.enum(BookReadingStatus).nullable().optional(),
    startedAt: z.coerce.date().nullable().optional(),
    startedAtPrecision: datePrecisionSchema.nullable().optional(),
    finishedAt: z.coerce.date().nullable().optional(),
    finishedAtPrecision: datePrecisionSchema.nullable().optional(),
    progressValue: z.number().int().nonnegative().nullable().optional(),
    progressUnit: z.enum(BookProgressUnit).optional(),
    rating: z
      .number()
      .int()
      .min(MIN_BOOK_RATING)
      .max(MAX_BOOK_RATING)
      .nullable()
      .optional(),
  })
  .refine(
    (v) =>
      v.progressUnit !== BookProgressUnit.percent ||
      v.progressValue == null ||
      v.progressValue <= MAX_PERCENT,
    {
      message: "Percent progress must be between 0 and 100",
      path: ["progressValue"],
    },
  )
  // Normalize each date to the start of its known period (e.g. "month"
  // precision truncates to the 1st) so a client can't send a mismatched
  // date/precision pair.
  .transform((v) => {
    const started = normalizeDateField(v.startedAt, v.startedAtPrecision);
    const finished = normalizeDateField(v.finishedAt, v.finishedAtPrecision);
    return {
      ...v,
      startedAt: started.date,
      startedAtPrecision: started.precision,
      finishedAt: finished.date,
      finishedAtPrecision: finished.precision,
    };
  })
  .refine(
    (v) =>
      !isReadingDateRangeInverted(
        v.startedAt ?? null,
        v.finishedAt ?? null,
        v.finishedAtPrecision ?? "day",
      ),
    {
      message: "Finished date cannot be before started date",
      path: ["finishedAt"],
    },
  );

export type BookReadingPatch = z.infer<typeof bookReadingSchema>;
