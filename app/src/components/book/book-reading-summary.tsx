import { BookReadingStatusIcon } from "@/components/book/book-reading-status-icon";
import { RatingStarsDisplay } from "@/components/ui/rating-stars";
import { readingDatesLabel } from "@/lib/books/review";
import { BOOK_READING_STATUS_LABELS } from "@/lib/items/book-reading-status";
import type { BookDetails } from "@/lib/types/item";
import { cn } from "@/lib/utils";

type BookReadingSummaryProps = {
  bookDetails: BookDetails;
  className?: string;
};

/**
 * Read-only display of a book's public reading data: status, rating, read
 * dates, and review. Used on public pages (single-item view, shelves) where the
 * owner's controls aren't rendered. Renders nothing when there's no reading
 * data to show. Reading progress is intentionally never shown here — it stays
 * private (see mapPublicBookDetails).
 */
export function BookReadingSummary({
  bookDetails,
  className,
}: BookReadingSummaryProps) {
  const { status, rating, review } = bookDetails;
  const dateLabel = readingDatesLabel(bookDetails);

  const hasReadingData =
    status !== null || rating !== null || review !== null || dateLabel !== null;
  if (!hasReadingData) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {(status !== null || rating !== null || dateLabel !== null) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {status !== null && (
            <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground text-xs">
              <BookReadingStatusIcon status={status} className="size-3" />
              {BOOK_READING_STATUS_LABELS[status]}
            </span>
          )}
          {rating !== null && <RatingStarsDisplay rating={rating} />}
          {dateLabel !== null && (
            <span className="text-muted-foreground text-sm">{dateLabel}</span>
          )}
        </div>
      )}
      {review !== null && (
        <p className="whitespace-pre-wrap text-foreground/90 text-sm md:text-base">
          {review}
        </p>
      )}
    </div>
  );
}
