"use client";

import Markdown from "markdown-to-jsx";
import type { ReactNode } from "react";
import { gridCardStyle } from "@/lib/grid-styles";

type NoteCardProps = {
  title: string | null;
  content: string;
  onClick?: () => void;
};

// The whole card is a <button>, so links can't render as anchors (invalid
// nesting). Render them as plain text in the preview.
function InlineText({ children }: { children?: ReactNode }) {
  return <span>{children}</span>;
}

/**
 * Grid card for a note item.
 *
 * Notes have no cover image, so the card itself is the content — a rendered
 * markdown preview of the body (clipped with a fade), with the title (if any)
 * as a heading.
 */
export function NoteCard({ title, content, onClick }: NoteCardProps) {
  const hasBody = content.trim().length > 0;

  return (
    <button
      type="button"
      className="group relative flex h-full w-full cursor-pointer flex-col overflow-hidden border border-amber-200/60 bg-amber-50 text-left transition-colors hover:border-amber-300 dark:border-amber-900/40 dark:bg-amber-950/30 dark:hover:border-amber-800"
      style={{ ...gridCardStyle, padding: "1.25em" }}
      onClick={onClick}
    >
      {title && (
        <p
          className="mb-[0.5em] line-clamp-2 shrink-0 font-semibold text-amber-950 dark:text-amber-100"
          style={{ fontSize: "1em" }}
        >
          {title}
        </p>
      )}
      {hasBody ? (
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <Markdown
            className="prose prose-sm dark:prose-invert prose-p:my-[0.4em] max-w-none prose-headings:font-semibold prose-headings:text-[1.05em] prose-headings:text-amber-950 text-amber-900/80 dark:prose-headings:text-amber-100 dark:text-amber-100/70"
            options={{
              forceBlock: true,
              overrides: { a: InlineText },
            }}
          >
            {content}
          </Markdown>
          {/* Fade out clipped content at the bottom */}
          <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-8 bg-gradient-to-t from-amber-50 to-transparent dark:from-amber-950" />
        </div>
      ) : (
        !title && (
          <p
            className="text-amber-900/50 italic dark:text-amber-100/40"
            style={{ fontSize: "0.875em" }}
          >
            Empty note
          </p>
        )
      )}
    </button>
  );
}
