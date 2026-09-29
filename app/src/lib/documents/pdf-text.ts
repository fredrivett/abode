/**
 * Fewest letters/digits a page's embedded text needs to be used as its text.
 * Below this the page is treated as scanned and OCR'd: a scan often carries
 * a stray page number or stamp but none of its content.
 */
export const MIN_TEXT_LAYER_CHARS = 20;

/**
 * Most of a page's text that may be garbage before the layer is distrusted.
 * A font without a Unicode mapping extracts as replacement or private-use
 * characters, which read as text but match no search.
 */
const MAX_GARBLED_RATIO = 0.1;

/**
 * U+FFFD (replacement), the private-use area, and control characters other
 * than tab/newline/carriage return — what an unmapped glyph extracts as
 */
function isGarbled(codePoint: number): boolean {
  return (
    codePoint === 0xfffd ||
    (codePoint >= 0xe000 && codePoint <= 0xf8ff) ||
    (codePoint < 0x20 &&
      codePoint !== 0x09 &&
      codePoint !== 0x0a &&
      codePoint !== 0x0d)
  );
}

const WORD_CHAR = /[\p{L}\p{N}]/gu;

/**
 * A PDF page's embedded text layer, or null when it isn't worth using and the
 * page should be OCR'd instead: empty (a scan), next to empty, or garbled.
 * Whitespace runs are collapsed so layout padding doesn't inflate the text.
 */
export function usableTextLayer(raw: string): string | null {
  const text = raw
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const wordChars = text.match(WORD_CHAR)?.length ?? 0;
  if (wordChars < MIN_TEXT_LAYER_CHARS) return null;
  let garbled = 0;
  for (const char of text) {
    if (isGarbled(char.codePointAt(0) ?? 0)) garbled++;
  }
  if (garbled / (wordChars + garbled) > MAX_GARBLED_RATIO) return null;
  return text;
}
