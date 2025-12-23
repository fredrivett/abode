"use client";

import type { ArticleHighlight } from "@prisma/client";
import { Highlighter, Trash2 } from "lucide-react";
import Markdown from "markdown-to-jsx";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  fromRange,
  toRange,
  wrapRangeWithHighlight,
} from "@/lib/highlights/dom-anchoring";
import {
  useCreateHighlight,
  useDeleteHighlight,
  useItemHighlights,
} from "@/lib/highlights/use-highlights";
import { TweetEmbed } from "./tweet-embed";

type HighlightData = Pick<
  ArticleHighlight,
  "id" | "startOffset" | "endOffset" | "text" | "note"
>;

type Props = {
  itemId: string;
  content: string;
  className?: string;
  onHighlightClick?: (highlight: HighlightData) => void;
  scrollToHighlightId?: string | null;
};

type SelectionState = {
  text: string;
  startOffset: number;
  endOffset: number;
  anchorRect: DOMRect;
} | null;

type ClickedHighlightState = {
  id: string;
  anchorRect: DOMRect;
  confirmDelete: boolean;
} | null;

const HIGHLIGHT_CLASS =
  "bg-yellow-400/25 dark:bg-yellow-500/30 text-inherit cursor-pointer transition-colors data-[active]:bg-yellow-400/40 dark:data-[active]:bg-yellow-500/50 data-[flash]:animate-highlight-flash";

const TWEET_MARKER_REGEX = /^\[\[TWEET:(\d+)\]\]$/;

/**
 * Custom paragraph component that renders tweet embeds when the content
 * matches the [[TWEET:id]] marker pattern.
 */
function TweetParagraph({ children }: { children?: ReactNode }) {
  // Check if this paragraph contains only a tweet marker
  if (typeof children === "string") {
    const match = children.match(TWEET_MARKER_REGEX);
    if (match) {
      return <TweetEmbed tweetId={match[1]} />;
    }
  }

  // Handle case where children is an array with a single string element
  if (
    Array.isArray(children) &&
    children.length === 1 &&
    typeof children[0] === "string"
  ) {
    const match = children[0].match(TWEET_MARKER_REGEX);
    if (match) {
      return <TweetEmbed tweetId={match[1]} />;
    }
  }

  return <p>{children}</p>;
}

/**
 * Article content with highlighting capabilities.
 * Renders markdown, then applies highlights to the DOM post-render.
 */
export function HighlightableArticle({
  itemId,
  content,
  className,
  onHighlightClick,
  scrollToHighlightId,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<SelectionState>(null);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(
    null,
  );
  const [clickedHighlight, setClickedHighlight] =
    useState<ClickedHighlightState>(null);

  const { data: highlights = [] } = useItemHighlights(itemId);
  const createHighlight = useCreateHighlight(itemId);
  const deleteHighlight = useDeleteHighlight(itemId);

  // Apply highlights to the DOM after markdown renders
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    // Remove existing highlights first
    const existingMarks = container.querySelectorAll("mark[data-highlight-id]");
    const parentsToNormalize = new Set<Node>();
    for (const mark of existingMarks) {
      const parent = mark.parentNode;
      if (parent) {
        const text = document.createTextNode(mark.textContent ?? "");
        parent.replaceChild(text, mark);
        parentsToNormalize.add(parent);
      }
    }
    // Normalize after all marks are removed to merge adjacent text nodes
    for (const parent of parentsToNormalize) {
      (parent as Element).normalize();
    }

    // Apply each highlight
    for (const highlight of highlights) {
      const range = toRange(
        container,
        highlight.startOffset,
        highlight.endOffset,
      );
      if (range) {
        wrapRangeWithHighlight(range, highlight.id, HIGHLIGHT_CLASS);
      }
    }
  }, [highlights]);

  // Scroll to highlight and flash it when scrollToHighlightId changes
  useEffect(() => {
    if (!scrollToHighlightId) return;
    const container = contentRef.current;
    if (!container) return;

    const marks = container.querySelectorAll(
      `mark[data-highlight-id="${scrollToHighlightId}"]`,
    );
    if (marks.length === 0) return;

    // Get the first mark element for scrolling
    const firstMark = marks[0] as HTMLElement;

    // Scroll into view
    firstMark.scrollIntoView({ behavior: "smooth", block: "center" });

    // Flash all marks with this highlight id
    for (const mark of marks) {
      const el = mark as HTMLElement;
      el.dataset.flash = "";
    }

    // Remove flash after animation
    const timeout = setTimeout(() => {
      for (const mark of marks) {
        const el = mark as HTMLElement;
        delete el.dataset.flash;
      }
    }, 1500);

    return () => clearTimeout(timeout);
  }, [scrollToHighlightId]);

  // Handle hover state for highlights
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const marks = container.querySelectorAll("mark[data-highlight-id]");
    for (const mark of marks) {
      const el = mark as HTMLElement;
      if (el.dataset.highlightId === activeHighlightId) {
        el.dataset.active = "";
      } else {
        delete el.dataset.active;
      }
    }
  }, [activeHighlightId]);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    const container = contentRef.current;

    if (!sel || sel.isCollapsed || !container) {
      setSelection(null);
      return;
    }

    const selectedText = sel.toString().trim();

    if (!selectedText || selectedText.length < 3) {
      setSelection(null);
      return;
    }

    // Verify selection is within our container
    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }

    // Calculate offsets from the rendered DOM
    const position = fromRange(container, range);
    const rect = range.getBoundingClientRect();

    setSelection({
      text: selectedText,
      startOffset: position.start,
      endOffset: position.end,
      anchorRect: rect,
    });
  }, []);

  const handleMouseOver = useCallback((e: React.MouseEvent) => {
    const mark = (e.target as Element).closest("mark[data-highlight-id]");
    if (mark) {
      setActiveHighlightId((mark as HTMLElement).dataset.highlightId ?? null);
    }
  }, []);

  const handleMouseOut = useCallback((e: React.MouseEvent) => {
    const mark = (e.target as Element).closest("mark[data-highlight-id]");
    if (mark) {
      setActiveHighlightId(null);
    }
  }, []);

  const handleFocus = useCallback((e: React.FocusEvent) => {
    const mark = (e.target as Element).closest("mark[data-highlight-id]");
    if (mark) {
      setActiveHighlightId((mark as HTMLElement).dataset.highlightId ?? null);
    }
  }, []);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    const mark = (e.target as Element).closest("mark[data-highlight-id]");
    if (mark) {
      setActiveHighlightId(null);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;

      const mark = (e.target as Element).closest("mark[data-highlight-id]");
      if (mark && onHighlightClick) {
        const highlightId = (mark as HTMLElement).dataset.highlightId;
        const highlight = highlights.find((h) => h.id === highlightId);
        if (highlight) {
          e.preventDefault();
          e.stopPropagation();
          onHighlightClick(highlight);
        }
      }
    },
    [highlights, onHighlightClick],
  );

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Don't show delete popover if user has selected text (they might want to create a new highlight)
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      return;
    }

    const mark = (e.target as Element).closest("mark[data-highlight-id]");
    if (mark) {
      const highlightId = (mark as HTMLElement).dataset.highlightId;
      if (highlightId) {
        e.stopPropagation();
        const rect = mark.getBoundingClientRect();
        // Always set fresh state to ensure position updates even if clicking a different highlight
        setClickedHighlight((prev) => {
          // If clicking the same highlight, just toggle it off
          if (prev?.id === highlightId) {
            return null;
          }
          return {
            id: highlightId,
            anchorRect: rect,
            confirmDelete: false,
          };
        });
      }
    }
  }, []);

  const handleCreateHighlight = useCallback(async () => {
    if (!selection) return;

    try {
      await createHighlight.mutateAsync({
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
        text: selection.text,
      });

      // Clear selection
      window.getSelection()?.removeAllRanges();
      setSelection(null);

      toast.success("Highlight created");
    } catch {
      toast.error("Failed to create highlight");
    }
  }, [selection, createHighlight]);

  const handleClosePopover = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleCloseHighlightPopover = useCallback(() => {
    setClickedHighlight(null);
  }, []);

  const handleDeleteClick = useCallback(() => {
    setClickedHighlight((prev) =>
      prev ? { ...prev, confirmDelete: true } : null,
    );
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!clickedHighlight) return;

    try {
      await deleteHighlight.mutateAsync(clickedHighlight.id);
      setClickedHighlight(null);
      toast.success("Highlight deleted");
    } catch {
      toast.error("Failed to delete highlight");
    }
  }, [clickedHighlight, deleteHighlight]);

  return (
    <div ref={containerRef}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Event delegation for highlights */}
      <div
        ref={contentRef}
        onMouseUp={handleMouseUp}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <Markdown
          className={className}
          options={{
            overrides: {
              p: TweetParagraph,
            },
          }}
        >
          {content}
        </Markdown>
      </div>

      <Popover
        open={!!selection}
        onOpenChange={(open) => !open && handleClosePopover()}
      >
        <PopoverAnchor
          style={{
            position: "fixed",
            left: selection
              ? selection.anchorRect.left + selection.anchorRect.width / 2
              : 0,
            top: selection ? selection.anchorRect.top - 8 : 0,
            width: 0,
            height: 0,
          }}
        />
        <PopoverContent
          side="top"
          sideOffset={8}
          className="w-auto p-1"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={handleCreateHighlight}
            disabled={createHighlight.isPending}
          >
            <Highlighter className="size-4" />
            Highlight
          </Button>
        </PopoverContent>
      </Popover>

      {/* Delete highlight popover */}
      <Popover
        key={clickedHighlight?.id}
        open={!!clickedHighlight}
        onOpenChange={(open) => !open && handleCloseHighlightPopover()}
      >
        <PopoverAnchor
          style={{
            position: "fixed",
            left: clickedHighlight
              ? clickedHighlight.anchorRect.left +
                clickedHighlight.anchorRect.width / 2
              : 0,
            top: clickedHighlight ? clickedHighlight.anchorRect.top - 8 : 0,
            width: 0,
            height: 0,
          }}
        />
        <PopoverContent
          side="top"
          sideOffset={8}
          className="w-auto p-1"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {clickedHighlight?.confirmDelete ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-destructive hover:text-destructive"
              onClick={handleConfirmDelete}
              disabled={deleteHighlight.isPending}
            >
              <Trash2 className="size-4" />
              Confirm delete?
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={handleDeleteClick}
            >
              <Trash2 className="size-4" />
              Delete highlight
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
