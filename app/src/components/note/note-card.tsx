"use client";

import Markdown from "markdown-to-jsx";
import { type ReactNode, useRef } from "react";
import { useIsOverflowing } from "@/hooks/use-is-overflowing";
import { gridCardStyle } from "@/lib/grid-styles";
import { NOTE_PROSE_CLASS, NOTE_PROSE_FONT_SIZE } from "./note-prose";

type NoteCardProps = {
  title: string | null;
  content: string;
  onClick?: () => void;
};

// The whole card is a <button>, so links can't render as anchors (invalid
// nesting). Render them as styled text so they keep their link affordance —
// the same underline treatment `.prose a` gets from globals.css.
function InlineText({ children }: { children?: ReactNode }) {
  return <span className="underline decoration-current/40">{children}</span>;
}

// Fade out clipped content — only rendered when there's more below the fold.
function FadeOverflow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[1.5em] bg-gradient-to-t from-card"
    />
  );
}

const TITLE_CLASS = "font-semibold font-serif text-foreground";
const TITLE_FONT_SIZE = "max(0.875rem, 1em)";

/**
 * Grid card for a note item.
 *
 * Notes have no cover image, so the card itself is the content — a rendered
 * markdown preview of the body (clipped with a fade), with the title (if any)
 * as a heading.
 */
export function NoteCard({ title, content, onClick }: NoteCardProps) {
  const hasBody = content.trim().length > 0;
  const bodyRef = useRef<HTMLDivElement>(null);
  const isOverflowing = useIsOverflowing(bodyRef);

  return (
    <button
      type="button"
      className="group relative flex h-full w-full cursor-pointer flex-col overflow-hidden border border-border bg-card text-left transition-colors hover:border-foreground/20"
      style={{ ...gridCardStyle, padding: "1.25em" }}
      onClick={onClick}
    >
      {/* Title as a clamped heading only when a body follows it */}
      {title && hasBody && (
        <p
          className={`mb-[0.5em] line-clamp-2 shrink-0 ${TITLE_CLASS}`}
          style={{ fontSize: TITLE_FONT_SIZE }}
        >
          {title}
        </p>
      )}
      {hasBody ? (
        <div ref={bodyRef} className="relative min-h-0 flex-1 overflow-hidden">
          <Markdown
            className={NOTE_PROSE_CLASS}
            style={{ fontSize: NOTE_PROSE_FONT_SIZE }}
            options={{
              forceBlock: true,
              overrides: { a: InlineText },
            }}
          >
            {content}
          </Markdown>
          {isOverflowing && <FadeOverflow />}
        </div>
      ) : title ? (
        // Title-only note: the title is the content — let it fill and fade
        // rather than hard-clamp at two lines and lose the rest.
        <div ref={bodyRef} className="relative min-h-0 flex-1 overflow-hidden">
          <p className={TITLE_CLASS} style={{ fontSize: TITLE_FONT_SIZE }}>
            {title}
          </p>
          {isOverflowing && <FadeOverflow />}
        </div>
      ) : (
        <p
          className="text-muted-foreground/60 italic"
          style={{ fontSize: NOTE_PROSE_FONT_SIZE }}
        >
          Empty note
        </p>
      )}
    </button>
  );
}
