import { format } from "date-fns";
import {
  type AspectBounds,
  type FrameAspect,
  stripInlineMarkdown,
  type TextMeasurer,
  toFrameAspect,
  WRAP_SAFETY,
  wrapLines,
} from "./card-aspect";

/**
 * Shared typography + content rules for the article/webpage grid card
 * (`ArticleCard`) and its masonry frame estimate, kept in one place so the
 * rendered card and the height the grid reserves for it can't drift.
 *
 * Both variants are a caption block — serif title, optional sans teaser and a
 * byline — under the cover image (cover variant) or alone (text variant). The
 * cover is never overlaid: article covers usually have the headline baked in,
 * so text on top collides with it.
 *
 * em values are relative to the card root (grid font scale); rem floors are
 * relative to the document root font size.
 */
export const ARTICLE_PADDING_EM = 1;
export const ARTICLE_TITLE_MIN_REM = 0.875;
export const ARTICLE_TITLE_LINE_HEIGHT = 1.3;
export const ARTICLE_TITLE_MAX_LINES = 3;
// Teaser and byline share the note prose size: max(0.75rem, 0.875em)
export const ARTICLE_SMALL_MIN_REM = 0.75;
export const ARTICLE_SMALL_EM = 0.875;
export const ARTICLE_SMALL_LINE_HEIGHT = 1.5;
export const ARTICLE_TEASER_MAX_LINES = 3;
export const ARTICLE_BYLINE_MAX_ROWS = 2;
// Gap between caption blocks (title → teaser → byline), in card em
export const ARTICLE_GAP_EM = 0.5;
// Byline separator slot ("·") before each part and the leading icon, in byline em
export const ARTICLE_BYLINE_SEP_EM = 1;
export const ARTICLE_BYLINE_ICON_EM = 1.1;
export const ARTICLE_BYLINE_ICON_GAP_EM = 0.35;

// Most covers are og:images (1200×630); without stored dims assume that. Real
// dims are clamped so a tall poster or a thin banner doesn't swamp the caption.
const DEFAULT_COVER_ASPECT = 1.91;
const MIN_COVER_ASPECT = 0.8;
const MAX_COVER_ASPECT = 2;

// A teaser shorter than this is usually a byline/date/kicker, not prose
const MIN_TEASER_CHARS = 40;
// Only three lines ever show, so there's no point carrying the whole article
const MAX_TEASER_CHARS = 400;

export const ARTICLE_ASPECT_BOUNDS: AspectBounds = {
  maxAspect: 8,
  // Caption is capped (title + teaser + byline), so this only bounds cover dims
  minAspect: 0.4,
};

function formatPublishedDate(value: string | Date | null | undefined) {
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

/** `www.example.com` → `example.com`; other subdomains are kept */
export function displayDomain(domain: string | null | undefined) {
  return domain ? domain.replace(/^www\./i, "") : null;
}

export type ArticleBylineInput = {
  author?: string | null;
  domain?: string | null;
  publishedAt?: string | Date | null;
  readingTime?: number | null;
};

/** Byline parts in order — who · when · how long; the author leads, else the domain */
export function articleBylineParts({
  author,
  domain,
  publishedAt,
  readingTime,
}: ArticleBylineInput): string[] {
  return [
    author?.trim() || displayDomain(domain),
    formatPublishedDate(publishedAt),
    readingTime ? `${readingTime} min read` : null,
  ].filter((part): part is string => Boolean(part));
}

function normalise(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

const NON_PROSE_BLOCK = /^\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>|```|~~~|<|!\[|\|)/;

/**
 * A short plain-text teaser for the text card: the publisher's description
 * when there is one, else the first prose paragraph of the extracted content
 * (skipping headings, lists, images and short kicker/byline lines). Null when
 * nothing reads as prose, or it only repeats the title.
 */
export function articleTeaser({
  title,
  description,
  content,
}: {
  title?: string | null;
  description?: string | null;
  content?: string | null;
}): string | null {
  const titleKey = title ? normalise(title) : null;
  const usable = (text: string) =>
    text.length > 0 && normalise(text) !== titleKey;

  const fromDescription = description?.replace(/\s+/g, " ").trim() ?? "";
  if (usable(fromDescription))
    return fromDescription.slice(0, MAX_TEASER_CHARS);

  for (const block of (content ?? "").replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
    if (NON_PROSE_BLOCK.test(block)) continue;
    const text = block
      .split("\n")
      .map(stripInlineMarkdown)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length >= MIN_TEASER_CHARS && usable(text)) {
      return text.slice(0, MAX_TEASER_CHARS);
    }
  }
  return null;
}

/** Cover width/height ratio the card's image band uses — stored dims, clamped */
export function articleCoverAspect(
  meta: Record<string, unknown> | null | undefined,
): number {
  const width = meta?.coverWidth;
  const height = meta?.coverHeight;
  if (
    typeof width === "number" &&
    typeof height === "number" &&
    width > 0 &&
    height > 0
  ) {
    return Math.min(
      MAX_COVER_ASPECT,
      Math.max(MIN_COVER_ASPECT, width / height),
    );
  }
  return DEFAULT_COVER_ASPECT;
}

/**
 * Rows the byline wraps to: parts break only between each other (never inside
 * one), each preceded by a separator slot; the leading icon rides with the first
 * part. A part wider than a row gets a row to itself and truncates.
 */
function bylineRows(
  parts: string[],
  availWidth: number,
  px: number,
  measure: TextMeasurer,
): number {
  const sep = ARTICLE_BYLINE_SEP_EM * px;
  const icon = (ARTICLE_BYLINE_ICON_EM + ARTICLE_BYLINE_ICON_GAP_EM) * px;
  // Every part carries its separator slot; a row-leading slot sits in the
  // clipped gutter, so a row holds availWidth + one slot
  const capacity = availWidth + sep;
  let rows = 1;
  let rowWidth = 0;
  parts.forEach((part, index) => {
    const width = sep + measure(part, { px }) + (index === 0 ? icon : 0);
    if (rowWidth > 0 && rowWidth + width > capacity) {
      rows++;
      rowWidth = Math.min(width, capacity);
    } else {
      rowWidth += width;
    }
  });
  return rows;
}

export type ArticleFrameInput = {
  title: string | null;
  teaser: string | null;
  bylineParts: string[];
  /** Cover width/height ratio when the cover variant renders, else null */
  coverAspect: number | null;
};

export type ArticleFrameContext = {
  columnWidthPx: number;
  cardRootPx: number;
  rootRemPx?: number;
  measure: TextMeasurer;
};

/** Height (px) of the caption block — padding, title, teaser and byline */
export function estimateArticleCaptionHeight(
  { title, teaser, bylineParts }: Omit<ArticleFrameInput, "coverAspect">,
  { columnWidthPx, cardRootPx, rootRemPx = 16, measure }: ArticleFrameContext,
): number {
  const padding = ARTICLE_PADDING_EM * cardRootPx;
  const gap = ARTICLE_GAP_EM * cardRootPx;
  const availWidth = Math.max(1, (columnWidthPx - 2 * padding) * WRAP_SAFETY);
  const titlePx = Math.max(ARTICLE_TITLE_MIN_REM * rootRemPx, cardRootPx);
  const smallPx = Math.max(
    ARTICLE_SMALL_MIN_REM * rootRemPx,
    ARTICLE_SMALL_EM * cardRootPx,
  );
  const smallLine = smallPx * ARTICLE_SMALL_LINE_HEIGHT;

  const blocks: number[] = [];
  const trimmedTitle = title?.trim();
  if (trimmedTitle) {
    const lines = wrapLines(trimmedTitle, availWidth, measure, {
      px: titlePx,
      weight: 600,
      family: "serif",
    });
    blocks.push(
      Math.min(ARTICLE_TITLE_MAX_LINES, lines) *
        titlePx *
        ARTICLE_TITLE_LINE_HEIGHT,
    );
  }
  if (teaser) {
    const lines = wrapLines(teaser, availWidth, measure, { px: smallPx });
    blocks.push(Math.min(ARTICLE_TEASER_MAX_LINES, lines) * smallLine);
  }
  if (bylineParts.length > 0) {
    const rows = bylineRows(bylineParts, availWidth, smallPx, measure);
    blocks.push(Math.min(ARTICLE_BYLINE_MAX_ROWS, rows) * smallLine);
  }

  const content = blocks.reduce((total, height) => total + height, 0);
  return 2 * padding + content + Math.max(0, blocks.length - 1) * gap;
}

/** Frame for an article/webpage card: cover band (if any) + measured caption */
export function estimateArticleAspect(
  input: ArticleFrameInput,
  context: ArticleFrameContext,
  bounds: AspectBounds = ARTICLE_ASPECT_BOUNDS,
): FrameAspect {
  const captionHeight = estimateArticleCaptionHeight(input, context);
  const coverHeight = input.coverAspect
    ? context.columnWidthPx / input.coverAspect
    : 0;
  return toFrameAspect(
    context.columnWidthPx,
    coverHeight + captionHeight,
    bounds,
  );
}
