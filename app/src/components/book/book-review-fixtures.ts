import type { BookReview } from "@/lib/books/review";

// Story fixtures for the book review share card, dialog and page
export const STORY_COVER_URL =
  "https://covers.openlibrary.org/b/isbn/9780141036144-L.jpg";

export const STORY_REVIEW: BookReview = {
  status: "read",
  rating: 9,
  review:
    "Bleak, precise and somehow still surprising. The appendix on Newspeak is the quiet masterstroke: it's written in the past tense.\n\nI read it once at school and missed almost everything. Second time round it felt less like a warning and more like a field guide.",
  startedAt: "2026-08-01T00:00:00.000Z",
  startedAtPrecision: "month",
  finishedAt: "2026-09-14T00:00:00.000Z",
  finishedAtPrecision: "day",
};

export const STORY_NO_READING: BookReview = {
  status: null,
  rating: null,
  review: null,
  startedAt: null,
  startedAtPrecision: null,
  finishedAt: null,
  finishedAtPrecision: null,
};
