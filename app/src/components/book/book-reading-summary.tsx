import { RatingStarsDisplay } from "@/components/ui/rating-stars";
import { BOOK_READING_STATUS_LABELS } from "@/lib/items/book-reading-status";
import { formatReadingDate } from "@/lib/items/date-precision";
import type { BookDetails } from "@/lib/types/item";
import { cn } from "@/lib/utils";

type BookReadingSummaryProps = {
  bookDetails: BookDetails;
  className?: string;
};

// Combine started/finished into a single human label. Both → a range; one side
// only → a labelled single date.
function readDatesLabel(bookDetails: BookDetails): string | null {
  const { startedAt, startedAtPrecision, finishedAt, finishedAtPrecision } =
    bookDetails;
  const started = startedAt
    ? formatReadingDate(startedAt, startedAtPrecision ?? "day")
    : null;
  const finished = finishedAt
    ? formatReadingDate(finishedAt, finishedAtPrecision ?? "day")
    : null;
  if (started && finished) return `${started} – ${finished}`;
  if (finished) return `Finished ${finished}`;
  if (started) return `Started ${started}`;
  return null;
}

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
  const dateLabel = readDatesLabel(bookDetails);

  const hasReadingData =
    status !== null || rating !== null || review !== null || dateLabel !== null;
  if (!hasReadingData) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {(status !== null || rating !== null || dateLabel !== null) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {status !== null && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground text-xs">
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
