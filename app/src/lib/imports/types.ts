import type { BookReadingStatus, DatePrecision } from "@prisma/client";

/**
 * Source-agnostic book record produced by an import adapter and consumed by the
 * shared book writer. Bibliographic fields map onto `Item`/`ItemBookDetails`;
 * `reading` carries the per-user shelf state. Keeping this neutral is the seam
 * that lets Goodreads/Pocket/Letterboxd adapters slot in later without touching
 * the writer.
 */
export type NormalizedBook = {
  /** The source's own id for this book (dedupe/debug; not stored as a key). */
  sourceId: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  authors: string[];
  publisher: string | null;
  publishedAt: Date | null;
  /** ISBN-13 preferred, else ISBN-10; null when the source has neither. */
  isbn: string | null;
  pageCount: number | null;
  language: string | null;
  /** Remote cover image URL; the writer downloads + stores it. */
  coverUrl: string | null;
  reading: NormalizedReadingState;
};

export type NormalizedReadingState = {
  /** null when the source shelf maps to no abode status (e.g. Literal `NONE`). */
  status: BookReadingStatus | null;
  /** abode /10 scale (half-stars doubled); null when unrated. */
  rating: number | null;
  review: string | null;
  /**
   * Best available "finished reading" date. Some sources (Literal) expose no
   * true finish timestamp, so this may be a proxy (review/shelf date). null when
   * unknown or not applicable to the shelf.
   */
  finishedAt: Date | null;
  finishedAtPrecision: DatePrecision | null;
  // No `startedAt`: no supported source exposes a reliable start date yet.
};

/** Import sources we can pull from. Only `literal` is implemented today. */
export type { ImportSource } from "@prisma/client";
