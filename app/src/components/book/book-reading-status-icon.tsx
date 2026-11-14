import type { BookReadingStatus } from "@prisma/client";
import {
  BookCheck,
  BookDashed,
  BookMarked,
  BookOpen,
  BookX,
  type LucideIcon,
} from "lucide-react";
import { CardCornerBadge } from "@/components/ui/card-overlay";
import {
  BOOK_READING_STATUS_LABELS,
  NOT_TRACKED_LABEL,
} from "@/lib/items/book-reading-status";

export const BOOK_READING_STATUS_ICONS: Record<BookReadingStatus, LucideIcon> =
  {
    want_to_read: BookMarked,
    reading: BookOpen,
    read: BookCheck,
    dnf: BookX,
  };

export const NOT_TRACKED_ICON: LucideIcon = BookDashed;

type BookReadingStatusIconProps = {
  // null = saved but not tracked
  status: BookReadingStatus | null;
  className?: string;
};

export function BookReadingStatusIcon({
  status,
  className,
}: BookReadingStatusIconProps) {
  const Icon = status ? BOOK_READING_STATUS_ICONS[status] : NOT_TRACKED_ICON;
  return (
    <Icon
      className={className}
      aria-hidden="true"
      data-status={status ?? "not_tracked"}
    />
  );
}

type BookReadingStatusBadgeProps = {
  // null = saved but not tracked
  status: BookReadingStatus | null;
};

/** Grid-card corner badge for a book's reading status; hover reveals the label */
export function BookReadingStatusBadge({
  status,
}: BookReadingStatusBadgeProps) {
  return (
    <CardCornerBadge
      icon={<BookReadingStatusIcon status={status} />}
      label={status ? BOOK_READING_STATUS_LABELS[status] : NOT_TRACKED_LABEL}
    />
  );
}
