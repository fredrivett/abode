import { BookProgressUnit, BookReadingStatus } from "@prisma/client";
import { z } from "zod";
import type { BookDetails } from "@/lib/types/item";

// Reading fields in their "not tracked" state. Used by read paths that don't
// (yet) surface per-user reading state — public shelves must not leak the
// owner's private reading status, and search-result cards don't render it.
export const UNTRACKED_BOOK_READING: Pick<
  BookDetails,
  | "status"
  | "startedAt"
  | "finishedAt"
  | "progressValue"
  | "progressUnit"
  | "progressUpdatedAt"
  | "rating"
> = {
  status: null,
  startedAt: null,
  finishedAt: null,
  progressValue: null,
  progressUnit: "page",
  progressUpdatedAt: null,
  rating: null,
};

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
    finishedAt: z.coerce.date().nullable().optional(),
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
  .refine(
    (v) =>
      v.startedAt == null ||
      v.finishedAt == null ||
      v.finishedAt >= v.startedAt,
    {
      message: "Finished date cannot be before started date",
      path: ["finishedAt"],
    },
  );

export type BookReadingPatch = z.infer<typeof bookReadingSchema>;
