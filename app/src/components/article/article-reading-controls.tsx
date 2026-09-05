"use client";

import { Check, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useArticleReading } from "@/lib/items/use-article-reading";
import { cn } from "@/lib/utils";

type ArticleReadingControlsProps = {
  itemId: string;
  /** ISO timestamp when marked read, or null when unread. */
  readAt: string | null;
  className?: string;
};

/**
 * Sidebar read toggle for an article. Binary: the button label is always the
 * action it performs ("Mark as read" / "Mark as unread"), and the state flips
 * optimistically so it feels instant; the server reconciles via the items-query
 * invalidation the mutation triggers.
 */
export function ArticleReadingControls({
  itemId,
  readAt,
  className,
}: ArticleReadingControlsProps) {
  const { setRead } = useArticleReading(itemId);
  const [isRead, setIsRead] = useState(readAt != null);

  // Re-sync from the server after a save invalidates the items query (mirrors
  // the book reading controls / notes pattern in the detail modal).
  useEffect(() => setIsRead(readAt != null), [readAt]);

  const toggle = () => {
    const next = !isRead;
    setIsRead(next);
    setRead(next);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <h3 className="font-semibold text-gray-700 text-sm dark:text-gray-300">
        Reading
      </h3>
      <Button
        variant={isRead ? "outline" : "default"}
        size="sm"
        className="w-full"
        onClick={toggle}
      >
        {isRead ? <RotateCcw /> : <Check />}
        {isRead ? "Mark as unread" : "Mark as read"}
      </Button>
    </div>
  );
}
