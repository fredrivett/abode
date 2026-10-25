"use client";

import { FileText } from "lucide-react";
import { useState } from "react";
import { BlurImage } from "@/components/ui/blur-image";
import { Img } from "@/components/ui/img";
import { gridCardStyle } from "@/lib/grid-styles";
import { GRID_IMAGE_SIZES } from "@/lib/image-url";
import {
  ARTICLE_BYLINE_ICON_EM,
  ARTICLE_BYLINE_ICON_GAP_EM,
  ARTICLE_BYLINE_MAX_ROWS,
  ARTICLE_BYLINE_SEP_EM,
  ARTICLE_GAP_EM,
  ARTICLE_PADDING_EM,
  ARTICLE_SMALL_EM,
  ARTICLE_SMALL_LINE_HEIGHT,
  ARTICLE_SMALL_MIN_REM,
  ARTICLE_TEASER_MAX_LINES,
  ARTICLE_TITLE_LINE_HEIGHT,
  ARTICLE_TITLE_MAX_LINES,
  ARTICLE_TITLE_MIN_REM,
  articleBylineParts,
  articleTeaser,
} from "@/lib/items/article-card-layout";
import { cn } from "@/lib/utils";

type ArticleCardProps = {
  title: string | null;
  /** Publisher description (og:description); preferred source for the teaser */
  description?: string | null;
  /** Extracted reader content as markdown; teaser fallback when no description */
  content: string | null;
  domain: string | null;
  readingTime: number | null;
  /** Byline author; leads the byline, falling back to the domain when absent */
  author?: string | null;
  /** Article publish date (ISO) */
  publishedAt?: string | null;
  /** Site favicon proxy URL; the byline shows a generic page icon without it */
  faviconUrl?: string | null;
  /**
   * Cover image proxy URL. When set, the card renders the cover variant: the
   * image above a title + byline caption. When null/undefined, the text
   * variant renders: title, teaser and byline.
   */
  coverUrl?: string | null;
  coverBlurDataUrl?: string | null;
  onClick?: () => void;
};

const SMALL_FONT_SIZE = `max(${ARTICLE_SMALL_MIN_REM}rem, ${ARTICLE_SMALL_EM}em)`;
const SMALL_LINE = `${ARTICLE_SMALL_LINE_HEIGHT}em`;

function BylineIcon({ faviconUrl }: { faviconUrl?: string | null }) {
  const [failed, setFailed] = useState(false);
  const size = `${ARTICLE_BYLINE_ICON_EM}em`;
  if (faviconUrl && !failed) {
    return (
      <Img
        src={faviconUrl}
        alt=""
        className="shrink-0 rounded-[0.2em] object-contain"
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <FileText className="shrink-0" style={{ width: size, height: size }} />
  );
}

/**
 * Byline parts wrap only between each other, capped at two rows. Every part
 * carries a leading "·" slot; the row is shifted left by one slot and clipped,
 * so a row-leading separator falls in the hidden gutter and never dangles.
 */
function Byline({
  parts,
  faviconUrl,
}: {
  parts: string[];
  faviconUrl?: string | null;
}) {
  if (parts.length === 0) return null;
  const sep = `${ARTICLE_BYLINE_SEP_EM}em`;
  return (
    <div
      className="shrink-0 overflow-hidden text-muted-foreground"
      style={{
        fontSize: SMALL_FONT_SIZE,
        lineHeight: SMALL_LINE,
        maxHeight: `${ARTICLE_BYLINE_MAX_ROWS * ARTICLE_SMALL_LINE_HEIGHT}em`,
      }}
    >
      <ul className="flex flex-wrap" style={{ marginLeft: `-${sep}` }}>
        {parts.map((part, index) => (
          <li
            key={part}
            // before:w-[1em] is the separator slot (ARTICLE_BYLINE_SEP_EM)
            className="relative flex min-w-0 max-w-full items-center before:absolute before:left-0 before:w-[1em] before:text-center before:content-['·']"
            style={{
              paddingLeft: sep,
              gap: `${ARTICLE_BYLINE_ICON_GAP_EM}em`,
            }}
          >
            {index === 0 && (
              // Keyed so a new favicon URL gets a fresh load attempt
              <BylineIcon key={faviconUrl ?? ""} faviconUrl={faviconUrl} />
            )}
            <span className="truncate">{part}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Grid card for an article/webpage item. A caption — serif title, teaser
 * (text variant only) and a wrapping byline — under the cover image, or on its
 * own when there's no cover. Text never sits on the cover: article covers
 * usually carry the headline already. Typography lives in
 * `@/lib/items/article-card-layout`, which the grid's frame estimate shares.
 */
export function ArticleCard({
  title,
  description,
  content,
  domain,
  author,
  publishedAt,
  readingTime,
  faviconUrl,
  coverUrl,
  coverBlurDataUrl,
  onClick,
}: ArticleCardProps) {
  const bylineParts = articleBylineParts({
    author,
    domain,
    publishedAt,
    readingTime,
  });
  const teaser = coverUrl
    ? null
    : articleTeaser({ title, description, content });

  return (
    <button
      type="button"
      className={cn(
        "group relative flex h-full w-full cursor-pointer flex-col overflow-hidden border border-border bg-card text-left transition-colors hover:border-foreground/20",
        // Coverless: the caption sits at the bottom if the frame runs tall
        !coverUrl && "justify-end",
      )}
      style={gridCardStyle}
      onClick={onClick}
    >
      {coverUrl && (
        // Absorbs any estimate slack so the caption is never clipped
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <BlurImage
            src={coverUrl}
            alt={title ?? ""}
            blurDataUrl={coverBlurDataUrl}
            className="absolute inset-0 h-full w-full object-cover"
            sizes={GRID_IMAGE_SIZES}
          />
        </div>
      )}
      <div
        className="flex shrink-0 flex-col"
        style={{
          padding: `${ARTICLE_PADDING_EM}em`,
          gap: `${ARTICLE_GAP_EM}em`,
        }}
      >
        {title?.trim() && (
          <p
            className="font-semibold font-serif text-foreground"
            style={{
              fontSize: `max(${ARTICLE_TITLE_MIN_REM}rem, 1em)`,
              lineHeight: ARTICLE_TITLE_LINE_HEIGHT,
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: ARTICLE_TITLE_MAX_LINES,
              overflow: "hidden",
            }}
          >
            {title}
          </p>
        )}
        {teaser && (
          <p
            className="text-muted-foreground"
            style={{
              fontSize: SMALL_FONT_SIZE,
              lineHeight: SMALL_LINE,
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: ARTICLE_TEASER_MAX_LINES,
              overflow: "hidden",
            }}
          >
            {teaser}
          </p>
        )}
        <Byline parts={bylineParts} faviconUrl={faviconUrl} />
      </div>
    </button>
  );
}
