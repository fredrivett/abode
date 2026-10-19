import Link from "next/link";
import { UserAvatar } from "@/components/avatar/user-avatar";
import { BookReadingStatusIcon } from "@/components/book/book-reading-status-icon";
import { RatingStarsDisplay } from "@/components/ui/rating-stars";
import {
  type BookReview,
  readingDatesLabel,
  reviewText,
} from "@/lib/books/review";
import { BOOK_READING_STATUS_LABELS } from "@/lib/items/book-reading-status";
import { cn } from "@/lib/utils";

export type BookReader = {
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

type ReaderReviewProps = {
  reader: BookReader;
  review: BookReview;
  className?: string;
};

function readerName(reader: BookReader): string {
  const name = [reader.firstName, reader.lastName].filter(Boolean).join(" ");
  if (name) return name;
  return reader.username ? `@${reader.username}` : "A reader";
}

/** Blank-line separated paragraphs, each with its single line breaks kept. */
function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * One reader's take on a book: who, how they rated it, when they read it, and
 * what they thought. Each part is optional and the layout closes up around
 * what's missing. Self-contained (no book details) so a book page can list
 * several readers' reviews.
 */
export function ReaderReview({ reader, review, className }: ReaderReviewProps) {
  const text = reviewText(review);
  const dates = readingDatesLabel(review);
  const name = readerName(reader);
  const href = reader.username ? `/@${reader.username}` : null;
  const showHandle = reader.username && name !== `@${reader.username}`;

  const byline = (
    <>
      <UserAvatar
        avatarUrl={reader.avatarUrl}
        firstName={reader.firstName}
        lastName={reader.lastName}
        username={reader.username}
        className="size-9"
        fallbackClassName="text-xs"
      />
      <span className="flex flex-col leading-tight">
        <span className="font-medium text-foreground text-sm">{name}</span>
        {showHandle && (
          <span className="text-muted-foreground text-xs">
            @{reader.username}
          </span>
        )}
      </span>
    </>
  );

  const hasDetails =
    review.rating !== null || review.status !== null || dates !== null;

  return (
    <figure
      className={cn(
        "rounded-2xl border border-border bg-muted/30 p-5 md:p-8",
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        {href ? (
          <Link
            href={href}
            className="-m-1 flex items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-accent/50"
          >
            {byline}
          </Link>
        ) : (
          <span className="flex items-center gap-2.5">{byline}</span>
        )}
        {review.status !== null && (
          <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground text-xs">
            <BookReadingStatusIcon
              status={review.status}
              className="size-3.5"
            />
            {BOOK_READING_STATUS_LABELS[review.status]}
          </span>
        )}
      </figcaption>

      {(review.rating !== null || dates !== null) && (
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          {review.rating !== null && (
            <RatingStarsDisplay rating={review.rating} starClassName="size-5" />
          )}
          {dates !== null && (
            <span className="text-muted-foreground text-sm">{dates}</span>
          )}
        </div>
      )}

      {text ? (
        <blockquote className="mt-6 space-y-4 font-serif text-foreground text-lg leading-relaxed md:text-xl">
          {paragraphs(text).map((p, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs can repeat; static, never-reordered list
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ))}
        </blockquote>
      ) : (
        !hasDetails && (
          <p className="mt-5 text-muted-foreground text-sm">
            On {name}'s bookshelf.
          </p>
        )
      )}
    </figure>
  );
}
