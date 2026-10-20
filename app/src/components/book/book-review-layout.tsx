import type { ReactNode } from "react";
import { ViewOnButton } from "@/components/ui/view-on-button";
import { DEFAULT_BOOK_COVER_RATIO } from "@/lib/book-cover";
import { isValidUrl } from "@/lib/url-utils";
import { cn } from "@/lib/utils";
import { BookCover3D } from "./book-cover-3d";

export type BookReviewLayoutBook = {
  id: string;
  title: string | null;
  authors: string[];
  publisher: string | null;
  publishedAt: string | null;
  pageCount: number | null;
  /** Image URL for the cover (e.g. the image proxy's), or null for none */
  coverUrl: string | null;
  /** Cover width/height (see getBookCoverRatio) */
  coverRatio?: number;
  /** Dominant cover colour, for the glow behind the book */
  coverColor?: string | null;
  sourceUrl: string | null;
  domain: string | null;
};

type BookReviewLayoutProps = {
  book: BookReviewLayoutBook;
  /** The review(s) of the book, under its title */
  children: ReactNode;
  className?: string;
};

/** "Simon & Schuster · 2023 · 688 pages", skipping whatever's missing. */
export function bookFactsLine(
  book: Pick<BookReviewLayoutBook, "publisher" | "publishedAt" | "pageCount">,
): string | null {
  const year = book.publishedAt
    ? new Date(book.publishedAt).getUTCFullYear()
    : null;
  const parts = [
    book.publisher,
    year !== null && !Number.isNaN(year) ? String(year) : null,
    book.pageCount ? `${book.pageCount} pages` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * A book with what readers thought of it: the 3D cover (sticky beside the
 * text on wide screens, above it on narrow ones), the title and authors, then
 * the reviews passed as children.
 */
export function BookReviewLayout({
  book,
  children,
  className,
}: BookReviewLayoutProps) {
  const title = book.title ?? "Untitled";
  const ratio = book.coverRatio ?? DEFAULT_BOOK_COVER_RATIO;
  const facts = bookFactsLine(book);
  const authorLine = book.authors.length > 0 ? book.authors.join(", ") : null;

  return (
    <div
      className={cn(
        "grid items-start gap-10 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] md:gap-16",
        className,
      )}
    >
      <div className="relative mx-auto w-full max-w-[200px] md:sticky md:top-10 md:max-w-none">
        {book.coverColor && (
          // Ambient glow in the cover's own colour
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-[15%] rounded-full opacity-25 blur-3xl dark:opacity-40"
            style={{ backgroundColor: book.coverColor }}
          />
        )}
        <div
          className="relative w-full"
          style={{ aspectRatio: ratio, containerType: "inline-size" }}
        >
          <BookCover3D
            src={book.coverUrl}
            alt={`Cover of ${title}`}
            coverColor={book.coverColor ?? undefined}
            fallback={
              <TypesetCover title={title} author={book.authors[0] ?? null} />
            }
          />
        </div>
      </div>

      <div className="min-w-0">
        <header className="mb-8 text-center md:text-left">
          <h1 className="text-balance font-serif text-4xl text-foreground leading-tight md:text-5xl">
            {title}
          </h1>
          {authorLine && (
            <p className="mt-3 text-lg text-muted-foreground">{authorLine}</p>
          )}
          {(facts || (book.sourceUrl && isValidUrl(book.sourceUrl))) && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-3 md:justify-start">
              {facts && (
                <span className="text-muted-foreground text-sm">{facts}</span>
              )}
              {book.sourceUrl && isValidUrl(book.sourceUrl) && (
                <ViewOnButton
                  href={book.sourceUrl}
                  label={book.domain ?? "site"}
                />
              )}
            </div>
          )}
        </header>

        {children}
      </div>
    </div>
  );
}

/** The front of a book saved without a cover image: its title, typeset. */
function TypesetCover({
  title,
  author,
}: {
  title: string;
  author: string | null;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-[12%] text-center text-white/90">
      <span className="font-serif text-[12cqw] leading-tight">{title}</span>
      {author && (
        <span className="mt-[6cqw] border-white/30 border-t pt-[5cqw] text-[6.5cqw] text-white/70">
          {author}
        </span>
      )}
    </div>
  );
}
