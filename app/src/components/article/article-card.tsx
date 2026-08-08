"use client";

import { FileText } from "lucide-react";
import Markdown from "markdown-to-jsx";
import type { ReactNode } from "react";
import {
  NOTE_PROSE_CLASS,
  NOTE_PROSE_FONT_SIZE,
} from "@/components/note/note-prose";
import { gridCardStyle } from "@/lib/grid-styles";

type ArticleCardProps = {
  title: string | null;
  /** Extracted reader content as markdown, or null when none was captured */
  content: string | null;
  domain: string | null;
  readingTime: number | null;
  onClick?: () => void;
};

// The whole card is a <button>, so links can't render as anchors (invalid
// nesting). Render them as styled text so they keep their link affordance.
function InlineText({ children }: { children?: ReactNode }) {
  return <span className="underline decoration-current/40">{children}</span>;
}

/**
 * Grid card for an article/webpage item with no cover image.
 *
 * Mirrors the note card: rather than a hollow icon placeholder, the card is the
 * content — the article's serif title over a rendered markdown preview of the
 * reader content (clipped with a fade) — with a small source footer (domain and
 * reading time) to keep its article identity.
 */
export function ArticleCard({
  title,
  content,
  domain,
  readingTime,
  onClick,
}: ArticleCardProps) {
  const hasBody = (content ?? "").trim().length > 0;
  const metaParts = [
    domain,
    readingTime ? `${readingTime} min read` : null,
  ].filter((part): part is string => Boolean(part));

  return (
    <button
      type="button"
      className="group relative flex h-full w-full cursor-pointer flex-col overflow-hidden border border-border bg-card text-left transition-colors hover:border-foreground/20"
      style={{ ...gridCardStyle, padding: "1.25em" }}
      onClick={onClick}
    >
      {title && (
        <p
          className="mb-[0.5em] line-clamp-2 shrink-0 font-semibold font-serif text-foreground"
          style={{ fontSize: "max(0.875rem, 1em)" }}
        >
          {title}
        </p>
      )}
      {hasBody && (
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <Markdown
            className={NOTE_PROSE_CLASS}
            style={{ fontSize: NOTE_PROSE_FONT_SIZE }}
            options={{
              forceBlock: true,
              overrides: { a: InlineText },
            }}
          >
            {content ?? ""}
          </Markdown>
          {/* Fade out clipped content; invisible over empty card background */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[1.5em] bg-gradient-to-t from-card"
          />
        </div>
      )}
      {metaParts.length > 0 && (
        <div
          className="mt-auto flex shrink-0 items-center gap-[0.4em] pt-[0.75em] text-muted-foreground"
          style={{ fontSize: NOTE_PROSE_FONT_SIZE }}
        >
          <FileText className="size-[1.1em] shrink-0" />
          <span className="truncate">{metaParts.join(" · ")}</span>
        </div>
      )}
    </button>
  );
}
