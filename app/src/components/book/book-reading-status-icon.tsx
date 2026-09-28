import type { BookReadingStatus } from "@prisma/client";
import {
  BookCheck,
  BookMarked,
  BookOpen,
  BookX,
  type LucideIcon,
} from "lucide-react";
import { BOOK_READING_STATUS_LABELS } from "@/lib/items/book-reading-status";
import { cn } from "@/lib/utils";

export const BOOK_READING_STATUS_ICONS: Record<BookReadingStatus, LucideIcon> =
  {
    want_to_read: BookMarked,
    reading: BookOpen,
    read: BookCheck,
    dnf: BookX,
  };

type BookReadingStatusIconProps = {
  status: BookReadingStatus;
  className?: string;
};

export function BookReadingStatusIcon({
  status,
  className,
}: BookReadingStatusIconProps) {
  const Icon = BOOK_READING_STATUS_ICONS[status];
  return <Icon className={className} aria-hidden="true" data-status={status} />;
}

type BookReadingStatusBadgeProps = {
  status: BookReadingStatus;
  className?: string;
};

/**
 * Grid-card corner badge for a book's reading status — mirrors the X badge on
 * tweet cards. Sized in em so it scales with the card like the rest of the tile.
 */
export function BookReadingStatusBadge({
  status,
  className,
}: BookReadingStatusBadgeProps) {
  const label = BOOK_READING_STATUS_LABELS[status];
  return (
    <div
      className={cn(
        "absolute rounded-full bg-black/60 backdrop-blur-sm",
        className,
      )}
      style={{ top: "0.5em", right: "0.5em", padding: "0.375em" }}
      title={label}
    >
      <BookReadingStatusIcon
        status={status}
        className="h-[0.75em] w-[0.75em] text-white"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
