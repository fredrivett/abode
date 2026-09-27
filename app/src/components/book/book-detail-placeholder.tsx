import { DEFAULT_BOOK_COVER_RATIO } from "@/lib/book-cover";
import { getProxyImageUrl } from "@/lib/image-url";
import type { BookDetails } from "@/lib/types/item";
import { cn } from "@/lib/utils";
import { BookCover3D } from "./book-cover-3d";

/**
 * Shown while the book view (a lazy chunk) loads: the same cover, title and
 * authors in BookDetailView's layout. The cover carries the grid card's
 * `layoutId`, so the card-to-dialog cover morph still lands on first open
 * (the grid already ships BookCover3D).
 */
export function BookDetailPlaceholder({
  itemId,
  bookDetails,
  title,
  coverFileKey,
  coverRatio = DEFAULT_BOOK_COVER_RATIO,
  coverColor,
  className,
}: {
  itemId: string;
  bookDetails: BookDetails;
  title?: string | null;
  coverFileKey?: string | null;
  coverRatio?: number;
  coverColor?: string;
  className?: string;
}) {
  const authorLine =
    bookDetails.authors.length > 0 ? bookDetails.authors.join(", ") : null;
  return (
    <div
      className={cn(
        "flex min-h-full w-full flex-col items-center justify-center bg-background p-6 md:p-8",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-sm space-y-8">
        {coverFileKey && (
          <div
            className="mx-auto w-full max-w-[240px]"
            style={{ aspectRatio: coverRatio }}
          >
            <BookCover3D
              src={getProxyImageUrl(coverFileKey, "full")}
              alt={title ?? "Book cover"}
              layoutId={`item-image-${itemId}`}
              coverColor={coverColor}
            />
          </div>
        )}
        <div className="space-y-1 text-center">
          {title && (
            <h2 className="font-semibold text-gray-900 text-xl dark:text-gray-100">
              {title}
            </h2>
          )}
          {authorLine && (
            <p className="text-gray-500 text-sm dark:text-gray-400">
              {authorLine}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
