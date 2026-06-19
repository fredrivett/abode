"use client";

import Markdown from "markdown-to-jsx";
import { type ReactNode, useEffect, useRef } from "react";
import { TweetEmbed } from "@/components/article/tweet-embed";
import {
  toRange,
  wrapRangeWithHighlight,
} from "@/lib/highlights/dom-anchoring";

export type ReadOnlyHighlight = {
  id: string;
  startOffset: number;
  endOffset: number;
  text: string;
  note: string | null;
};

type Props = {
  content: string;
  className?: string;
  highlights: ReadOnlyHighlight[];
  scrollToHighlightId?: string | null;
};

const HIGHLIGHT_CLASS =
  "bg-yellow-400/25 dark:bg-yellow-500/30 text-inherit transition-colors data-[flash]:animate-highlight-flash";

const TWEET_MARKER_REGEX = /^\[\[TWEET:(\d+)\]\]$/;

/**
 * Renders a tweet embed when a paragraph contains only a [[TWEET:id]] marker.
 * Mirrors the behaviour of HighlightableArticle's TweetParagraph.
 */
function TweetParagraph({ children }: { children?: ReactNode }) {
  if (typeof children === "string") {
    const match = children.match(TWEET_MARKER_REGEX);
    if (match) {
      return <TweetEmbed tweetId={match[1]} />;
    }
  }

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
 * Read-only article renderer for the public item page.
 *
 * Unlike HighlightableArticle (which fetches highlights from the owner-only
 * API and supports creating/deleting them), this renders server-provided
 * highlights directly so signed-out viewers can see a shared article with its
 * highlights. It still supports scroll-to/flash for a `scrollToHighlightId`.
 */
export function ReadOnlyArticle({
  content,
  className,
  highlights,
  scrollToHighlightId,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Apply highlights to the DOM after markdown renders.
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

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
    for (const parent of parentsToNormalize) {
      (parent as Element).normalize();
    }

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

  // Scroll to and flash the target highlight when present.
  useEffect(() => {
    if (!scrollToHighlightId) return;
    const container = contentRef.current;
    if (!container) return;

    // Static selector + JS comparison — the highlight id comes from a
    // user-controlled query param, so it must never be interpolated into a
    // CSS selector (invalid characters would throw at runtime).
    const marks = Array.from(
      container.querySelectorAll<HTMLElement>("mark[data-highlight-id]"),
    ).filter((mark) => mark.dataset.highlightId === scrollToHighlightId);
    if (marks.length === 0) return;

    marks[0].scrollIntoView({ behavior: "smooth", block: "center" });

    for (const mark of marks) {
      mark.dataset.flash = "";
    }

    const timeout = setTimeout(() => {
      for (const mark of marks) {
        delete mark.dataset.flash;
      }
    }, 1500);

    return () => clearTimeout(timeout);
  }, [scrollToHighlightId]);

  return (
    <div ref={contentRef}>
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
  );
}
