"use client";

import Markdown from "markdown-to-jsx";
import type { ReactNode } from "react";
import { gridCardStyle } from "@/lib/grid-styles";
import { NOTE_PROSE_CLASS } from "./note-prose";

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
      className="group relative flex h-full w-full cursor-pointer flex-col overflow-hidden border border-border bg-card text-left transition-colors hover:border-foreground/20"
      style={{ ...gridCardStyle, padding: "1.25em" }}
      onClick={onClick}
    >
      {title && (
        <p
          className="mb-[0.5em] line-clamp-2 shrink-0 font-semibold text-foreground"
          style={{ fontSize: "1em" }}
        >
          {title}
        </p>
      )}
      {hasBody ? (
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <Markdown
            className={NOTE_PROSE_CLASS}
            options={{
              forceBlock: true,
              overrides: { a: InlineText },
            }}
          >
            {content}
          </Markdown>
        </div>
      ) : (
        !title && (
          <p
            className="text-muted-foreground/60 italic"
            style={{ fontSize: "0.875em" }}
          >
            Empty note
          </p>
        )
      )}
    </button>
  );
}
