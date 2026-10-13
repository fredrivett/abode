import { getAppBaseUrl } from "@/lib/url";

/** The bits of a highlight the share UI needs */
export type ShareableHighlight = { id: string; text: string };

type HighlightShareTarget = {
  username: string;
  itemId: string;
  highlightId: string;
};

/** Public page for a single shared highlight (with its own share card). */
export function highlightSharePath({
  username,
  itemId,
  highlightId,
}: HighlightShareTarget): string {
  return `/@${username}/items/${itemId}/highlights/${highlightId}`;
}

export function highlightShareUrl(target: HighlightShareTarget): string {
  return `${getAppBaseUrl()}${highlightSharePath(target)}`;
}

/** Collapse runs of whitespace (highlights can span paragraphs). */
export function normalizeHighlightText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

/** Truncate to at most `max` chars, backing off to a word boundary. */
export function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  // Don't cut between the halves of a surrogate pair (emoji, rare CJK)
  const end = isHighSurrogate(text.charCodeAt(max - 2)) ? max - 2 : max - 1;
  const slice = text.slice(0, end);
  const lastSpace = slice.lastIndexOf(" ");
  // Only back off to the space when it doesn't throw away most of the slice
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[\s.,;:!?—–-]+$/, "")}…`;
}

// Quote size steps for the 1200x630 share card: shorter quotes get bigger type,
// and anything past the last step is truncated so it never overflows the card
const QUOTE_STEPS = [
  { maxChars: 90, fontSize: 60 },
  { maxChars: 160, fontSize: 50 },
  { maxChars: 240, fontSize: 42 },
] as const;
const LONG_QUOTE = { maxChars: 300, fontSize: 36 } as const;

export type HighlightQuoteLayout = { text: string; fontSize: number };

/** Fit a highlight's text to the share card: pick a type size and truncate. */
export function highlightQuoteLayout(rawText: string): HighlightQuoteLayout {
  const text = normalizeHighlightText(rawText);
  const step = QUOTE_STEPS.find((s) => text.length <= s.maxChars);
  if (step) return { text, fontSize: step.fontSize };
  return {
    text: truncateAtWord(text, LONG_QUOTE.maxChars),
    fontSize: LONG_QUOTE.fontSize,
  };
}

/** Plain-text quote with attribution (and link, if given), for pasting anywhere. */
export function formatHighlightQuote({
  text,
  title,
  url,
}: {
  text: string;
  title: string | null;
  url?: string;
}): string {
  const quote = `“${normalizeHighlightText(text)}”`;
  return [quote, title ? `— ${title}` : null, url ?? null]
    .filter((line) => line !== null)
    .join("\n");
}
