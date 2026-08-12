/**
 * Content-driven aspect ratios for coverless text cards (notes and text-only
 * tweets) in the masonry grid.
 *
 * The masonry engine (`@masonry-grid/react`) sizes every frame from an aspect
 * ratio it's given up front — it never measures rendered content. So a note or
 * a text tweet gets whatever fixed ratio we hand it, regardless of how much
 * text it holds. These estimators replace those fixed ratios with a ratio
 * derived from the content: short text → short card, long text → taller card up
 * to a clamped max, past which the card's existing overflow-fade takes over.
 *
 * The estimate is deliberately approximate — it never has to be pixel-perfect.
 * Every error collapses into one of two graceful outcomes bounded by the clamp:
 * a little empty space at the bottom (over-estimate) or the fade appearing
 * slightly early (under-estimate). We bias mildly generous so text is rarely
 * clipped before the max. Text width comes from a real font measurer (injected
 * so this stays pure and testable); everything else is known geometry from the
 * card components' typography.
 */

/** A family bucket the measurer resolves to a concrete font stack. */
export type CardFontFamily = "sans" | "serif";

export type CardTextStyle = {
  px: number;
  weight?: number;
  family?: CardFontFamily;
};

/** Measures the rendered width (px) of a single line of `text` in `style`. */
export type TextMeasurer = (text: string, style: CardTextStyle) => number;

/** Frame dimensions for `@masonry-grid` — only their ratio (width/height) is used. */
export type FrameAspect = { width: number; height: number };

export type AspectBounds = {
  /**
   * Widest, shortest card. A high value means "no min-height" — a one-line card
   * is exactly one line tall. It only exists as a sanity bound against
   * degenerate near-zero content heights.
   */
  maxAspect: number;
  /** Tallest card; beyond this the overflow-fade does the truncating. */
  minAspect: number;
};

// Snap the final ratio to discrete steps so near-identical content doesn't
// produce visibly different heights (jitter) and the aspect transition animates
// between clean stops.
const ASPECT_STEP = 0.05;

// Text almost never fills a line to 100% — word boundaries force a wrap before
// the edge, and font metrics carry slack. Counting wraps against a slightly
// narrower width biases the estimate a hair taller so fit-content lands with
// room to spare rather than clipping into a false overflow-fade.
const WRAP_SAFETY = 0.9;

// --- Note typography (see note-card.tsx + note-prose.ts) ---------------------
// em values are relative to the card root (grid font-scale); rem floors are
// relative to the document root font size — both are passed in, never assumed.
const NOTE_PADDING_EM = 1.25; // p-[1.25em]
const NOTE_TITLE_MIN_REM = 0.875; // max(0.875rem, 1em)
const NOTE_TITLE_LINE_HEIGHT = 1.5; // serif title, no explicit leading — runs tall
const NOTE_TITLE_MB_EM = 0.5; // mb-[0.5em]
const NOTE_TITLE_MAX_LINES = 2; // line-clamp-2
const NOTE_BODY_MIN_REM = 0.75; // max(0.75rem, 0.875em)
const NOTE_BODY_EM = 0.875;
// prose-sm paragraph line-height is 1.714; round up a hair so a fit estimate is
// never shorter than the real text (which would clip and show a false fade).
const NOTE_BODY_LINE_HEIGHT = 1.72;
const NOTE_HEADING_LINE_HEIGHT = 1.3; // prose-headings:leading-[1.25], rounded up
const NOTE_BLOCK_GAP_EM = 0.4; // prose-p:my-[0.4em], collapsed between siblings
const NOTE_LIST_ITEM_GAP_EM = 0.15; // prose-li:my-[0.15em]
// A fenced code block renders as a padded <pre> box. Its vertical padding is a
// fixed cost on top of the code lines — matters most for short blocks — so
// include it. Kept in body-em terms (generous vs the slightly smaller mono).
const NOTE_CODE_PADDING_EM = 0.7; // prose-sm pre padding-y, per side
// Heading sizes relative to body em (prose-h1..h6 in note-prose.ts).
const NOTE_HEADING_SCALE: Record<number, number> = {
  1: 1.25,
  2: 1.15,
  3: 1.05,
  4: 1.0,
  5: 0.9,
  6: 0.85,
};

export const NOTE_ASPECT_BOUNDS: AspectBounds = {
  // No min-height: one line renders one line tall.
  maxAspect: 8,
  minAspect: 0.8,
};

// --- Text-only tweet typography (see twitter-card.tsx) -----------------------
// All rem-based: the tweet body uses `text-sm`, spacing is `p-4`/`gap-2`, the
// avatar `size-6` — so they track the document root font size (not grid
// density). Expressed in rem and multiplied by the live root size.
const TWEET_PAD_REM = 1; // p-4
const TWEET_HEADER_GAP_REM = 0.5; // gap-2 between header and body
const TWEET_AVATAR_REM = 1.5; // size-6 avatar
const TWEET_BODY_REM = 0.875; // text-sm
const TWEET_BODY_LINE_HEIGHT = 1.375; // leading-snug

export const TWEET_ASPECT_BOUNDS: AspectBounds = {
  // No min-height: one line renders one line tall.
  maxAspect: 8,
  minAspect: 0.75,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** How many visual lines `text` wraps to at `availWidth`. Blank → 1. */
function wrapLines(
  text: string,
  availWidth: number,
  measure: TextMeasurer,
  style: CardTextStyle,
): number {
  const trimmed = text.trim();
  if (!trimmed) return 1;
  const width = measure(trimmed, style);
  return Math.max(1, Math.ceil(width / availWidth));
}

/** Clamp + quantize a content height into a masonry frame aspect ratio. */
function toFrameAspect(
  columnWidthPx: number,
  contentHeightPx: number,
  bounds: AspectBounds,
): FrameAspect {
  const raw = columnWidthPx / Math.max(1, contentHeightPx);
  const clamped = clamp(raw, bounds.minAspect, bounds.maxAspect);
  // Floor (not round): a smaller aspect is a taller box, so quantizing down only
  // ever gives the content *more* room — it never shrinks the box below the
  // estimate and clips fit-content into a false fade.
  const quantized = Math.floor(clamped / ASPECT_STEP) * ASPECT_STEP;
  // Integer-ish width over a fixed height keeps the ratio while reading cleanly.
  return { width: Math.round(quantized * 100), height: 100 };
}

// Strip inline markdown that doesn't affect line width much, so measurement
// tracks the visible glyphs: emphasis/code markers, heading/quote/list markers,
// and link syntax (keep the link text, drop the URL).
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // [text](url) / ![alt](url) → text
    .replace(/[*_~`]+/g, "")
    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+)/, "")
    .trim();
}

const ATX_HEADING = /^\s{0,3}(#{1,6})\s+/;
const LIST_ITEM = /^\s{0,3}([-*+]|\d+\.)\s+/;
const FENCE = /^\s{0,3}(```|~~~)/;
// Markdown hard break: a source line ending in two+ spaces or a backslash
// renders as a forced line break (<br>) rather than a collapsed soft wrap.
const HARD_BREAK = / {2,}$|\\$/;

type NoteBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; lines: number }
  | { type: "paragraph"; segments: string[] };

/**
 * Within a paragraph, soft line breaks collapse into one wrapped run, but hard
 * breaks force a new line — so split into segments at hard breaks and measure
 * each on its own (each is at least one line).
 */
function toParagraphSegments(rawLines: string[]): string[] {
  const segments: string[] = [];
  let current: string[] = [];
  for (const raw of rawLines) {
    current.push(stripInlineMarkdown(raw));
    if (HARD_BREAK.test(raw)) {
      segments.push(current.join(" "));
      current = [];
    }
  }
  if (current.length) segments.push(current.join(" "));
  return segments;
}

/**
 * Split note markdown into blocks the way the renderer roughly groups them:
 * fenced code, headings, list runs, and blank-line-separated paragraphs.
 */
function toBlocks(markdown: string): NoteBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: NoteBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({
        type: "paragraph",
        segments: toParagraphSegments(paragraph),
      });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push({ type: "list", items: list });
      list = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (FENCE.test(line)) {
      flushParagraph();
      flushList();
      let count = 0;
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) {
        count++;
        i++;
      }
      blocks.push({ type: "code", lines: Math.max(1, count) });
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(ATX_HEADING);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: stripInlineMarkdown(line),
      });
      continue;
    }

    if (LIST_ITEM.test(line)) {
      flushParagraph();
      list.push(stripInlineMarkdown(line));
      continue;
    }

    flushList();
    // Keep the raw line — hard-break detection needs its trailing whitespace.
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function estimateNoteBodyHeight(
  body: string,
  availWidth: number,
  bodyPx: number,
  measure: TextMeasurer,
): number {
  const blocks = toBlocks(body);
  let height = 0;

  blocks.forEach((block, index) => {
    // Vertical margins between siblings collapse to ~one block gap.
    if (index > 0) height += NOTE_BLOCK_GAP_EM * bodyPx;

    switch (block.type) {
      case "heading": {
        const px = bodyPx * (NOTE_HEADING_SCALE[block.level] ?? 1);
        const lines = wrapLines(block.text, availWidth, measure, {
          px,
          weight: 600,
        });
        height += lines * px * NOTE_HEADING_LINE_HEIGHT;
        break;
      }
      case "code":
        // Code doesn't wrap in prose; count raw lines, plus the <pre> padding.
        height +=
          2 * NOTE_CODE_PADDING_EM * bodyPx +
          block.lines * bodyPx * NOTE_BODY_LINE_HEIGHT;
        break;
      case "list":
        block.items.forEach((item, itemIndex) => {
          if (itemIndex > 0) height += NOTE_LIST_ITEM_GAP_EM * bodyPx;
          const lines = wrapLines(item, availWidth, measure, { px: bodyPx });
          height += lines * bodyPx * NOTE_BODY_LINE_HEIGHT;
        });
        break;
      default: {
        // Each hard-break segment wraps on its own and is at least one line.
        const lines = block.segments.reduce(
          (total, segment) =>
            total + wrapLines(segment, availWidth, measure, { px: bodyPx }),
          0,
        );
        height += lines * bodyPx * NOTE_BODY_LINE_HEIGHT;
      }
    }
  });

  return height;
}

export type NoteAspectInput = { title: string | null; body: string };
export type NoteAspectContext = {
  columnWidthPx: number;
  /** Card root font size in px (grid font-scale × root rem). */
  cardRootPx: number;
  /** Document root font size in px — what `1rem` resolves to. Defaults to 16. */
  rootRemPx?: number;
  measure: TextMeasurer;
};

/** Estimate a note card's frame aspect from its title + markdown body. */
export function estimateNoteAspect(
  { title, body }: NoteAspectInput,
  { columnWidthPx, cardRootPx, rootRemPx = 16, measure }: NoteAspectContext,
  bounds: AspectBounds = NOTE_ASPECT_BOUNDS,
): FrameAspect {
  const padding = NOTE_PADDING_EM * cardRootPx;
  const availWidth = Math.max(1, (columnWidthPx - 2 * padding) * WRAP_SAFETY);
  const bodyPx = Math.max(
    NOTE_BODY_MIN_REM * rootRemPx,
    NOTE_BODY_EM * cardRootPx,
  );

  let height = 2 * padding;

  const trimmedTitle = title?.trim();
  if (trimmedTitle) {
    const titlePx = Math.max(NOTE_TITLE_MIN_REM * rootRemPx, cardRootPx);
    const titleLines = Math.min(
      NOTE_TITLE_MAX_LINES,
      wrapLines(trimmedTitle, availWidth, measure, {
        px: titlePx,
        weight: 600,
        family: "serif",
      }),
    );
    height += titleLines * titlePx * NOTE_TITLE_LINE_HEIGHT;
    height += NOTE_TITLE_MB_EM * cardRootPx;
  }

  if (body.trim()) {
    height += estimateNoteBodyHeight(body, availWidth, bodyPx, measure);
  } else if (!trimmedTitle) {
    // "Empty note" placeholder is a single line.
    height += bodyPx * NOTE_BODY_LINE_HEIGHT;
  }

  return toFrameAspect(columnWidthPx, height, bounds);
}

export type TweetAspectInput = { text: string; hasAvatar: boolean };
export type TweetAspectContext = {
  columnWidthPx: number;
  /** Document root font size in px — what `1rem` resolves to. Defaults to 16. */
  rootRemPx?: number;
  measure: TextMeasurer;
};

/** Estimate a text-only tweet card's frame aspect from its text. */
export function estimateTweetAspect(
  { text, hasAvatar }: TweetAspectInput,
  { columnWidthPx, rootRemPx = 16, measure }: TweetAspectContext,
  bounds: AspectBounds = TWEET_ASPECT_BOUNDS,
): FrameAspect {
  const padding = TWEET_PAD_REM * rootRemPx;
  const bodyPx = TWEET_BODY_REM * rootRemPx;
  const bodyLinePx = bodyPx * TWEET_BODY_LINE_HEIGHT;
  const availWidth = Math.max(1, (columnWidthPx - 2 * padding) * WRAP_SAFETY);
  // Header is the author row; the avatar (1.5rem) dominates its own text line.
  const headerPx = hasAvatar ? TWEET_AVATAR_REM * rootRemPx : bodyLinePx;

  // `whitespace-pre-wrap` keeps hard newlines; each source line wraps on its own.
  const bodyLines = text
    .split("\n")
    .reduce(
      (total, line) =>
        total + wrapLines(line, availWidth, measure, { px: bodyPx }),
      0,
    );

  const height =
    2 * padding +
    headerPx +
    TWEET_HEADER_GAP_REM * rootRemPx +
    bodyLines * bodyLinePx;

  return toFrameAspect(columnWidthPx, height, bounds);
}
