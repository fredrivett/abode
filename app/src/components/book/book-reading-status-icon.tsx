import type { BookReadingStatus } from "@prisma/client";
import {
  BookCheck,
  BookDashed,
  BookMarked,
  BookOpen,
  BookX,
  type LucideIcon,
} from "lucide-react";
import {
  BOOK_READING_STATUS_LABELS,
  NOT_TRACKED_LABEL,
} from "@/lib/items/book-reading-status";
import { cn } from "@/lib/utils";

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
  className?: string;
};

/**
 * Grid-card corner badge for a book's reading status — mirrors the X badge on
 * tweet cards. Sized in em so it scales with the card like the rest of the tile.
 * Hovering the badge slides the label out to the left of the icon; the label
 * stays in the accessibility tree while collapsed.
 */
export function BookReadingStatusBadge({
  status,
  className,
}: BookReadingStatusBadgeProps) {
  const label = status ? BOOK_READING_STATUS_LABELS[status] : NOT_TRACKED_LABEL;
  return (
    <div
      className={cn(
        "group/status-badge absolute flex items-center rounded-full bg-black/60 text-white backdrop-blur-sm",
        className,
      )}
      style={{ top: "0.5em", right: "0.5em", padding: "0.375em" }}
    >
      {/* 0fr → 1fr grid track animates the label's intrinsic width */}
      <span className="grid grid-cols-[0fr] transition-[grid-template-columns] duration-200 ease-out group-hover/status-badge:grid-cols-[1fr] motion-reduce:transition-none">
        <span className="overflow-hidden">
          <span
            className="block whitespace-nowrap font-medium leading-none"
            style={{
              fontSize: "0.625em",
              paddingLeft: "0.4em",
              paddingRight: "0.5em",
            }}
          >
            {label}
          </span>
        </span>
      </span>
      <BookReadingStatusIcon
        status={status}
        className="h-[0.75em] w-[0.75em] shrink-0"
      />
    </div>
  );
}
