import { Check, Circle } from "lucide-react";
import { CardCornerBadge } from "@/components/ui/card-overlay";

type ArticleReadStatusBadgeProps = {
  /** ISO timestamp when marked read, or null when unread */
  readAt: string | null;
};

/**
 * Grid-card corner badge for an article's read state, the article counterpart
 * of the book reading status badge: a dot while unread, a check once read.
 * Hover reveals the label.
 */
export function ArticleReadStatusBadge({
  readAt,
}: ArticleReadStatusBadgeProps) {
  const isRead = readAt !== null;
  return (
    <CardCornerBadge
      icon={
        isRead ? (
          <Check aria-hidden="true" data-status="read" strokeWidth={3} />
        ) : (
          <Circle
            aria-hidden="true"
            data-status="unread"
            className="scale-[0.55] fill-current"
          />
        )
      }
      label={isRead ? "Read" : "Unread"}
    />
  );
}
