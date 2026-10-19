import { normalizeHighlightText, truncateAtWord } from "@/lib/highlights/share";
import { BOOK_READING_STATUS_LABELS } from "@/lib/items/book-reading-status";
import { formatPublicReadingDate } from "@/lib/items/date-precision";
import type { BookDetails } from "@/lib/types/item";
import { getAppBaseUrl } from "@/lib/url";

/**
 * One reader's public take on a book: the reading data that leaves a public
 * page (see mapPublicBookDetails). Kept separate from the book itself so a
 * page can show many readers' reviews of the same book.
 */
export type BookReview = Pick<
  BookDetails,
  | "status"
  | "rating"
  | "review"
  | "startedAt"
  | "startedAtPrecision"
  | "finishedAt"
  | "finishedAtPrecision"
>;

export function toBookReview(book: BookReview): BookReview {
  return {
    status: book.status,
    rating: book.rating,
    review: book.review,
    startedAt: book.startedAt,
    startedAtPrecision: book.startedAtPrecision,
    finishedAt: book.finishedAt,
    finishedAtPrecision: book.finishedAtPrecision,
  };
}

type BookReviewShareTarget = { username: string; itemId: string };

/** Public page for a reader's review of a book (with its own share card). */
export function bookReviewSharePath({
  username,
  itemId,
}: BookReviewShareTarget): string {
  return `/@${username}/items/${itemId}/review`;
}

export function bookReviewShareUrl(target: BookReviewShareTarget): string {
  return `${getAppBaseUrl()}${bookReviewSharePath(target)}`;
}

/** The review text, or null when it's missing or only whitespace. */
export function reviewText(review: BookReview): string | null {
  const text = review.review?.trim();
  return text ? text : null;
}

/**
 * Started/finished as one label: a range, or a labelled single date. For
 * public surfaces, so dates read the same in every timezone.
 */
export function readingDatesLabel(review: BookReview): string | null {
  const { startedAt, startedAtPrecision, finishedAt, finishedAtPrecision } =
    review;
  const started = startedAt
    ? formatPublicReadingDate(startedAt, startedAtPrecision ?? "day")
    : null;
  const finished = finishedAt
    ? formatPublicReadingDate(finishedAt, finishedAtPrecision ?? "day")
    : null;
  if (started && finished) {
    return started === finished ? started : `${started} – ${finished}`;
  }
  if (finished) return `Finished ${finished}`;
  if (started) return `Started ${started}`;
  return null;
}

/** "@fred · Read · Nov 2023 – Oct 19, 2026", skipping whatever's missing. */
export function bookReviewByline({
  username,
  review,
}: {
  username: string;
  review: BookReview;
}): string {
  return [
    `@${username}`,
    review.status ? BOOK_READING_STATUS_LABELS[review.status] : null,
    readingDatesLabel(review),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** A /10 rating as stars out of five, e.g. 7 → "★★★½". */
export function ratingStarsText(rating: number): string {
  const whole = Math.floor(rating / 2);
  return `${"★".repeat(whole)}${rating % 2 === 1 ? "½" : ""}`;
}

/** A /10 rating read aloud, e.g. 7 → "3.5 out of 5". */
export function ratingLabel(rating: number): string {
  return `${rating / 2} out of 5`;
}

// Type steps for the 1200x630 card's title and review excerpt. The review
// shares its column with the title, so a title that wraps leaves it less room
const TITLE_STEPS = [
  { maxChars: 18, fontSize: 60 },
  { maxChars: 44, fontSize: 48 },
] as const;
const LONG_TITLE = { maxChars: 64, fontSize: 40 } as const;
const SOLO_TITLE_SCALE = 1.25; // No review: the title carries the card
// The text column's width, and a serif glyph's average advance (in ems, with
// slack for word wrap), to guess whether the title wraps
const CARD_TEXT_WIDTH = 676;
const SERIF_ADVANCE = 0.52;

const REVIEW_STEPS = [
  { maxChars: 110, fontSize: 34 },
  { maxChars: 180, fontSize: 30 },
] as const;
const LONG_REVIEW = { fontSize: 27 } as const;
// Excerpt budget for a one-line title, and for one that wraps
const REVIEW_BUDGET = { oneLine: 300, wrapped: 220 } as const;

export type BookReviewCardLayout = {
  title: { text: string; fontSize: number };
  review: { text: string; fontSize: number } | null;
};

/** Fit a book's title and review to the share card: type sizes + truncation. */
export function bookReviewCardLayout({
  title: rawTitle,
  review: rawReview,
}: {
  title: string;
  review: string | null;
}): BookReviewCardLayout {
  const titleText = normalizeHighlightText(rawTitle);
  const titleStep =
    TITLE_STEPS.find((s) => titleText.length <= s.maxChars) ?? LONG_TITLE;
  const title = {
    text: truncateAtWord(titleText, LONG_TITLE.maxChars),
    fontSize: titleStep.fontSize,
  };

  const reviewTextValue = rawReview ? normalizeHighlightText(rawReview) : "";
  if (!reviewTextValue) {
    return {
      title: {
        ...title,
        fontSize: Math.round(title.fontSize * SOLO_TITLE_SCALE),
      },
      review: null,
    };
  }

  const titleFitsOneLine =
    title.text.length <=
    Math.floor(CARD_TEXT_WIDTH / (title.fontSize * SERIF_ADVANCE));
  const budget = titleFitsOneLine
    ? REVIEW_BUDGET.oneLine
    : REVIEW_BUDGET.wrapped;
  const reviewStep = REVIEW_STEPS.find(
    (s) => reviewTextValue.length <= s.maxChars,
  );
  return {
    title,
    review: reviewStep
      ? { text: reviewTextValue, fontSize: reviewStep.fontSize }
      : {
          text: truncateAtWord(reviewTextValue, budget),
          fontSize: LONG_REVIEW.fontSize,
        },
  };
}

/** "Title by Author", or just the title when there's no author. */
export function bookTitleLine({
  title,
  authors,
}: {
  title: string;
  authors: string[];
}): string {
  return authors.length > 0 ? `${title} by ${authors.join(", ")}` : title;
}

/** Plain-text review with the book (and link, if given), for pasting anywhere. */
export function formatBookReview({
  title,
  authors,
  review,
  url,
}: {
  title: string;
  authors: string[];
  review: BookReview;
  url?: string;
}): string {
  const heading = [
    review.rating ? ratingStarsText(review.rating) : null,
    bookTitleLine({ title, authors }),
  ]
    .filter(Boolean)
    .join(" ");
  const text = reviewText(review);
  return [heading, text, url ?? null]
    .filter((part) => part !== null)
    .join("\n\n");
}

/** Meta description for the review page: an excerpt, else the rating. */
export function bookReviewDescription({
  username,
  title,
  review,
}: {
  username: string;
  title: string;
  review: BookReview;
}): string {
  const text = reviewText(review);
  if (text) return truncateAtWord(normalizeHighlightText(text), 160);
  if (review.rating) {
    return `@${username} rated ${title} ${ratingLabel(review.rating)}`;
  }
  return `${title}, on @${username}'s bookshelf`;
}
