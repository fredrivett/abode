"use client";

import { format } from "date-fns";
import { FileText } from "lucide-react";
import Markdown from "markdown-to-jsx";
import type { ReactNode } from "react";
import {
  NOTE_PROSE_CLASS,
  NOTE_PROSE_FONT_SIZE,
} from "@/components/note/note-prose";
import { BlurImage } from "@/components/ui/blur-image";
import { gridCardStyle } from "@/lib/grid-styles";
import { cn } from "@/lib/utils";

type ArticleCardProps = {
  title: string | null;
  /** Extracted reader content as markdown, or null when none was captured */
  content: string | null;
  domain: string | null;
  readingTime: number | null;
  /** Byline author; leads the source meta, falling back to the domain when absent */
  author?: string | null;
  /** Article publish date (ISO). Shown in the source meta of both variants. */
  publishedAt?: string | null;
  /**
   * Cover image proxy URL. When set, the card renders the cover variant: the
   * image full-bleed behind a gradient with bottom-aligned title + source meta
   * (no body). When null/undefined, the note-style text variant renders.
   */
  coverUrl?: string | null;
  coverBlurDataUrl?: string | null;
  onClick?: () => void;
};

// The whole card is a <button>, so links can't render as anchors (invalid
// nesting). Render them as styled text so they keep their link affordance.
function InlineText({ children }: { children?: ReactNode }) {
  return <span className="underline decoration-current/40">{children}</span>;
}

function formatPublishedDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // Format the UTC calendar date so a date-only/near-midnight value never shows
  // a day early in negative-offset timezones
  return format(
    new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    "MMM d, yyyy",
  );
}

/**
 * Grid card for an article/webpage item.
 *
 * With a cover image: the image sits full-bleed behind a dark gradient, with
 * the serif title and byline meta aligned to the bottom — no body.
 *
 * Without a cover image: mirrors the note card — the card is the content, the
 * article's serif title over a rendered markdown preview of the reader content
 * (clipped with a fade), with a small source footer. The column is
 * bottom-aligned, so with no body the title sits by the footer instead of
 * stranding at the top; body content pushes it up.
 *
 * Both footers read as a byline — author (or domain) · date · reading time —
 * with each part dropped when absent.
 */
export function ArticleCard({
  title,
  content,
  domain,
  author,
  publishedAt,
  readingTime,
  coverUrl,
  coverBlurDataUrl,
  onClick,
}: ArticleCardProps) {
  const readingLabel = readingTime ? `${readingTime} min read` : null;
  // Byline order — who · when · how long; the author leads, else the domain
  const source = author || domain;
  const metaParts = [
    source,
    formatPublishedDate(publishedAt),
    readingLabel,
  ].filter((part): part is string => Boolean(part));

  if (coverUrl) {
    return (
      <button
        type="button"
        className="group relative flex h-full w-full cursor-pointer flex-col justify-end overflow-hidden border border-border text-left transition-colors hover:border-foreground/20"
        style={gridCardStyle}
        onClick={onClick}
      >
        <BlurImage
          src={coverUrl}
          alt={title ?? ""}
          blurDataUrl={coverBlurDataUrl}
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Gradient backdrop keeps the bottom-aligned text legible over any cover */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"
        />
        <div
          className="relative flex flex-col gap-[0.4em] text-white"
          style={{ padding: "1.25em" }}
        >
          {title && (
            <p
              className="line-clamp-3 font-semibold font-serif"
              style={{ fontSize: "max(0.875rem, 1em)" }}
            >
              {title}
            </p>
          )}
          {metaParts.length > 0 && (
            <div
              className="flex items-center gap-[0.4em] text-white/80"
              style={{ fontSize: NOTE_PROSE_FONT_SIZE }}
            >
              <FileText className="size-[1.1em] shrink-0" />
              <span className="truncate">{metaParts.join(" · ")}</span>
            </div>
          )}
        </div>
      </button>
    );
  }

  const hasBody = (content ?? "").trim().length > 0;

  return (
    <button
      type="button"
      className="group relative flex h-full w-full cursor-pointer flex-col justify-end overflow-hidden border border-border bg-card text-left transition-colors hover:border-foreground/20"
      style={{ ...gridCardStyle, padding: "1.25em" }}
      onClick={onClick}
    >
      {title && (
        <p
          className={cn(
            "line-clamp-2 shrink-0 font-semibold font-serif text-foreground",
            // Only separate from the body; with no body the title sits by the footer
            hasBody && "mb-[0.5em]",
          )}
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
          className="flex shrink-0 items-center gap-[0.4em] pt-[0.75em] text-muted-foreground"
          style={{ fontSize: NOTE_PROSE_FONT_SIZE }}
        >
          <FileText className="size-[1.1em] shrink-0" />
          <span className="truncate">{metaParts.join(" · ")}</span>
        </div>
      )}
    </button>
  );
}
