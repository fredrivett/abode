"use client";

import type { ArticleHighlight } from "@prisma/client";
import Markdown from "markdown-to-jsx";
import { useMemo } from "react";

type HighlightData = Pick<
  ArticleHighlight,
  "id" | "startOffset" | "endOffset" | "text" | "note"
>;

type Props = {
  content: string;
  highlights: HighlightData[];
  className?: string;
  onHighlightClick?: (highlight: HighlightData) => void;
};

/**
 * Renders markdown content with highlights overlaid.
 * Highlights are injected as <mark> tags at the specified offsets.
 */
export function HighlightedMarkdown({
  content,
  highlights,
  className,
  onHighlightClick,
}: Props) {
  // Process content to inject highlight markers
  const processedContent = useMemo(() => {
    if (highlights.length === 0) return content;

    // Sort highlights by startOffset descending so we can insert from end to start
    // This prevents offset shifting issues
    const sortedHighlights = [...highlights].sort(
      (a, b) => b.startOffset - a.startOffset,
    );

    let result = content;

    for (const highlight of sortedHighlights) {
      const { startOffset, endOffset, id } = highlight;

      // Validate offsets
      if (
        startOffset < 0 ||
        endOffset > result.length ||
        startOffset >= endOffset
      ) {
        continue;
      }

      const before = result.slice(0, startOffset);
      const highlighted = result.slice(startOffset, endOffset);
      const after = result.slice(endOffset);

      // Inject mark tag with data attribute for identification
      result = `${before}<mark data-highlight-id="${id}">${highlighted}</mark>${after}`;
    }

    return result;
  }, [content, highlights]);

  const markdownOptions = useMemo(
    () => ({
      overrides: {
        mark: {
          component: ({
            children,
            ...props
          }: React.HTMLAttributes<HTMLElement> & {
            "data-highlight-id"?: string;
          }) => {
            const highlightId = props["data-highlight-id"];
            const highlight = highlights.find((h) => h.id === highlightId);

            return (
              <mark
                {...props}
                className="bg-yellow-200/70 dark:bg-yellow-500/30 px-0.5 rounded-sm cursor-pointer hover:bg-yellow-300/70 dark:hover:bg-yellow-500/50 transition-colors"
                onClick={(e) => {
                  if (highlight && onHighlightClick) {
                    e.stopPropagation();
                    onHighlightClick(highlight);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && highlight && onHighlightClick) {
                    e.stopPropagation();
                    onHighlightClick(highlight);
                  }
                }}
                role={onHighlightClick ? "button" : undefined}
                tabIndex={onHighlightClick ? 0 : undefined}
              >
                {children}
              </mark>
            );
          },
        },
      },
    }),
    [highlights, onHighlightClick],
  );

  return (
    <Markdown className={className} options={markdownOptions}>
      {processedContent}
    </Markdown>
  );
}
