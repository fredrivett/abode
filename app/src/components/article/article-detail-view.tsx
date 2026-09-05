"use client";

import { Check } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { decodeHtmlEntities } from "@/lib/html-metadata";
import { useArticleReading } from "@/lib/items/use-article-reading";
import { HighlightableArticle } from "./highlightable-article";

type ArticleDetailViewProps = {
  itemId: string;
  content: string;
  /** Original page title (from the article's HTML), shown as a heading */
  originalName?: string;
  scrollToHighlightId?: string | null;
  /** Saved 0..1 scroll fraction to resume to when the article opens. */
  initialScrollProgress?: number | null;
  /** ISO timestamp when marked read, or null when unread. */
  readAt?: string | null;
  /**
   * Only the item owner tracks scroll progress and can mark the article read
   * (and sees the end-of-article nudge). Off for read-only viewers (e.g. admin).
   */
  enableTracking?: boolean;
};

function isScrollable(el: HTMLElement): boolean {
  const overflowY = getComputedStyle(el).overflowY;
  return (
    (overflowY === "auto" || overflowY === "scroll") &&
    el.scrollHeight - el.clientHeight > 1
  );
}

/**
 * Resolve the element that actually scrolls the article. On desktop it's this
 * component's own `overflow-y-auto` container; on mobile the inner content isn't
 * height-bounded and the outer dialog container scrolls instead. Walk up to
 * whichever genuinely overflows so resume + progress work on both.
 */
function resolveScroller(container: HTMLElement): HTMLElement | null {
  if (isScrollable(container)) return container;
  let node = container.parentElement;
  while (node) {
    if (isScrollable(node)) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Detail view for an article item: the extracted reader content with
 * highlighting. Mirrors the other per-kind detail views (product/video/note)
 * so the item dialog renders each kind through a dedicated component. For the
 * owner it also restores the saved scroll position, persists reading progress,
 * and offers an end-of-article "mark as read" nudge.
 */
export function ArticleDetailView({
  itemId,
  content,
  originalName,
  scrollToHighlightId,
  initialScrollProgress = null,
  readAt = null,
  enableTracking = false,
}: ArticleDetailViewProps) {
  const { setRead, saveScrollProgress } = useArticleReading(itemId);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasRestoredRef = useRef(false);
  const [isRead, setIsRead] = useState(readAt != null);

  // Re-sync read state from the server after a save invalidates the items query.
  useEffect(() => setIsRead(readAt != null), [readAt]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const scroller = resolveScroller(container);
    if (!scroller) return;

    // Restore the saved position once (guarded so an effect re-run — e.g. when
    // a progress save refetches new props — never yanks the reader back).
    if (!hasRestoredRef.current) {
      const maxScroll = scroller.scrollHeight - scroller.clientHeight;
      if (initialScrollProgress != null && maxScroll > 0) {
        scroller.scrollTop = initialScrollProgress * maxScroll;
      }
      hasRestoredRef.current = true;
    }

    if (!enableTracking) return;
    const onScroll = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      const fraction =
        max > 0 ? Math.min(Math.max(scroller.scrollTop / max, 0), 1) : 0;
      saveScrollProgress(fraction);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      // Flush any pending debounced write so a scroll-then-close (within the
      // debounce window) still persists the final resume position.
      saveScrollProgress.flush();
    };
  }, [initialScrollProgress, enableTracking, saveScrollProgress]);

  const handleMarkRead = async () => {
    setIsRead(true);
    const ok = await setRead(true);
    if (!ok) setIsRead(false);
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-12"
    >
      <article className="mx-auto w-full max-w-prose">
        {originalName && (
          <h1 className="mb-6 font-bold font-serif text-2xl text-foreground md:text-3xl lg:mb-8 lg:text-4xl">
            {decodeHtmlEntities(originalName)}
          </h1>
        )}
        <HighlightableArticle
          itemId={itemId}
          content={content}
          className="prose prose-sm md:prose-base lg:prose-lg prose-neutral dark:prose-invert max-w-none prose-headings:font-serif prose-li:font-serif prose-p:font-serif"
          scrollToHighlightId={scrollToHighlightId}
        />
        {enableTracking && !isRead && (
          <div className="mt-8 flex flex-col items-center gap-3 border-t pt-6 text-center">
            <p className="text-muted-foreground text-sm">
              You've reached the end. Mark this article as read?
            </p>
            <Button size="sm" onClick={() => void handleMarkRead()}>
              <Check />
              Mark as read
            </Button>
          </div>
        )}
      </article>
    </div>
  );
}
