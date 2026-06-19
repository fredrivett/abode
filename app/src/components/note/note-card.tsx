"use client";

import { gridCardStyle } from "@/lib/grid-styles";
import { markdownToPlainText } from "@/lib/markdown";

type NoteCardProps = {
  title: string | null;
  content: string;
  onClick?: () => void;
};

/**
 * Grid card for a note item.
 *
 * Notes have no cover image, so the card itself is the content — a text preview
 * of the markdown body, with the title (if any) as a heading.
 */
export function NoteCard({ title, content, onClick }: NoteCardProps) {
  const preview = markdownToPlainText(content);
  const hasBody = preview.length > 0;

  return (
    <button
      type="button"
      className="group flex h-full w-full cursor-pointer flex-col overflow-hidden border border-amber-200/60 bg-amber-50 text-left transition-colors hover:border-amber-300 dark:border-amber-900/40 dark:bg-amber-950/30 dark:hover:border-amber-800"
      style={{ ...gridCardStyle, padding: "1.25em" }}
      onClick={onClick}
    >
      {title && (
        <p
          className="mb-[0.5em] line-clamp-2 font-semibold text-amber-950 dark:text-amber-100"
          style={{ fontSize: "1em" }}
        >
          {title}
        </p>
      )}
      {hasBody ? (
        <p
          className="line-clamp-[8] whitespace-pre-wrap text-amber-900/80 dark:text-amber-100/70"
          style={{ fontSize: "0.875em" }}
        >
          {preview}
        </p>
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
