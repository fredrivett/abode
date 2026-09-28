import type { BookReadingStatus } from "@prisma/client";
import {
  fetchReadingStates,
  fetchReviews,
  LiteralApiError,
  type LiteralReadingState,
  type LiteralReadingStatus,
  type LiteralReview,
  loginToLiteral,
  profileIdFromToken,
} from "@/lib/imports/literal/client";
import type { NormalizedBook } from "@/lib/imports/types";

const MAX_REVIEW_LENGTH = 5000;

// `NONE` is intentionally omitted (→ null); a Partial map also degrades any
// unexpected future Literal status to null rather than leaking undefined.
const STATUS_MAP: Partial<Record<LiteralReadingStatus, BookReadingStatus>> = {
  WANTS_TO_READ: "want_to_read",
  IS_READING: "reading",
  FINISHED: "read",
  DROPPED: "dnf",
};

/** Literal shelf → abode reading status. `NONE` (and anything unknown) → null. */
export function mapReadingStatus(
  status: LiteralReadingStatus,
): BookReadingStatus | null {
  return STATUS_MAP[status] ?? null;
}

/**
 * Literal rating (Float 0–5, half-star steps) → abode Int /10. Doubles and
 * rounds (5→10, 3.5→7). Returns null when there's no rating or it rounds below
 * abode's minimum of 1 (a 0-star rating is treated as unrated).
 */
export function mapRating(rating: number | null | undefined): number | null {
  if (rating == null || !Number.isFinite(rating)) return null;
  const scaled = Math.round(rating * 2);
  if (scaled < 1) return null;
  return Math.min(scaled, 10);
}

function normalizeReviewText(text: string | null | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_REVIEW_LENGTH);
}

/**
 * Parse Literal's `publishedDate` (format varies / often null). Accepts a
 * 4-digit year or anything Date-parseable; returns null otherwise.
 */
export function parseLiteralPublishedDate(
  value: string | null | undefined,
): Date | null {
  if (!value) return null;
  if (/^\d{4}$/.test(value)) return new Date(Date.UTC(Number(value), 0, 1));
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/**
 * Map one Literal reading state (+ its optional review) to a NormalizedBook.
 * Literal exposes no true finish date, so `finishedAt` uses the review date when
 * present, else the shelf's `createdAt` for FINISHED books — at `day` precision.
 */
export function toNormalizedBook(
  state: LiteralReadingState & {
    book: NonNullable<LiteralReadingState["book"]>;
  },
  review: LiteralReview | null,
): NormalizedBook {
  const book = state.book;
  const rating = mapRating(review?.rating);
  const reviewText = normalizeReviewText(review?.text);

  // A rating or review is strong evidence the book was read (you can't really
  // review an unread book), so an unshelved book (Literal `NONE` → null) that has
  // one imports as `read` rather than untracked. Shelved books keep their real
  // status even if reviewed (e.g. a mid-read review stays `reading`).
  const status =
    mapReadingStatus(state.status) ??
    (rating != null || reviewText != null ? "read" : null);

  // finishedAt applies to terminal shelves (read/dnf), keyed off the *effective*
  // status so an inferred-read book still gets a date — the review date if present,
  // else the shelf-entry date. Active shelves stay null.
  const isTerminal = status === "read" || status === "dnf";
  const finishedRaw = isTerminal
    ? (review?.createdAt ?? state.createdAt)
    : null;
  const finishedAt = finishedRaw ? new Date(finishedRaw) : null;
  const validFinished =
    finishedAt && !Number.isNaN(finishedAt.getTime()) ? finishedAt : null;

  const added = state.createdAt ? new Date(state.createdAt) : null;
  const addedAt = added && !Number.isNaN(added.getTime()) ? added : null;

  return {
    sourceId: book.id,
    title: book.title,
    subtitle: book.subtitle ?? null,
    description: book.description ?? null,
    authors: (book.authors ?? []).map((a) => a.name).filter(Boolean),
    publisher: book.publisher ?? null,
    publishedAt: parseLiteralPublishedDate(book.publishedDate),
    isbn: book.isbn13 || book.isbn10 || null,
    pageCount: book.pageCount && book.pageCount > 0 ? book.pageCount : null,
    language: book.language ?? null,
    coverUrl: book.cover ?? null,
    addedAt,
    reading: {
      status,
      rating,
      review: reviewText,
      finishedAt: validFinished,
      finishedAtPrecision: validFinished ? "day" : null,
    },
  };
}

export type LiteralCredentials =
  | { token: string }
  | { email: string; password: string };

/**
 * Fetch a user's full Literal library as NormalizedBooks. Resolves the token +
 * profileId (from the JWT for a token, or via `login` for email/password), pulls
 * all reading states in one call, then batch-fetches reviews and zips them back
 * by index. Reading states whose book is missing (deleted upstream) are skipped.
 */
export async function fetchLiteralBooks(
  creds: LiteralCredentials,
): Promise<NormalizedBook[]> {
  let token: string;
  let profileId: string | null;

  if ("token" in creds) {
    token = creds.token;
    profileId = profileIdFromToken(token);
  } else {
    const session = await loginToLiteral(creds);
    token = session.token;
    profileId = session.profileId;
  }
  if (!profileId) {
    throw new LiteralApiError("Could not resolve Literal profile id");
  }

  const states = await fetchReadingStates(token);
  const withBook = states.filter(
    (s): s is LiteralReadingState & { book: NonNullable<typeof s.book> } =>
      s.book != null,
  );

  const reviews = await fetchReviews(
    token,
    withBook.map((s) => ({ profileId, bookId: s.book.id })),
  );

  return withBook.map((state, i) =>
    toNormalizedBook(state, reviews[i] ?? null),
  );
}
