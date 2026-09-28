/**
 * Quoted phrases in a search query: `"on the equality of all things"` means
 * "only items containing exactly this text" (case-insensitive), rather than the
 * usual fuzzy full-text + semantic match. Straight and curly quotes both count,
 * since phones autocorrect `"` to `“ ”`.
 */

/**
 * A closed quote pair: straight `"…"` or curly `“…”`, each only closed by its
 * own glyph so a curly pair nested in a straight one doesn't split it.
 * Unclosed or mismatched quotes are left as text.
 */
const QUOTED_SPAN = /"([^"]*)"|“([^“”]*)”/g;

export type QuotedSpan = { start: number; end: number; phrase: string };

/** Char spans wrapped in quotes, with the trimmed phrase inside each. */
export function findQuotedSpans(query: string): QuotedSpan[] {
  return Array.from(query.matchAll(QUOTED_SPAN), (match) => ({
    start: match.index,
    end: match.index + match[0].length,
    phrase: (match[1] ?? match[2]).replace(/\s+/g, " ").trim(),
  }));
}

/**
 * Split a query into its exact phrases and the plain text to rank with. The
 * text keeps the phrase words (so full-text/vector still rank on them) but drops
 * every quote character, which would otherwise just be noise to both.
 */
export function parseQuotedQuery(query: string): {
  text: string;
  phrases: string[];
} {
  const phrases = [
    ...new Set(
      findQuotedSpans(query)
        .map((span) => span.phrase)
        .filter((phrase) => phrase.length > 0),
    ),
  ];
  const text = query.replace(/["“”]/g, " ").replace(/\s+/g, " ").trim();
  return { text, phrases };
}

/** Escape Postgres ARE metacharacters so a phrase matches literally. */
function escapeRegex(value: string): string {
  return value.replace(/[\\.^$*+?()[\]{}|]/g, "\\$&");
}

/**
 * A case-insensitive (`~*`) Postgres regex matching the phrase literally, with
 * any run of whitespace between its words — so a phrase still matches when OCR
 * or a description wraps it across a line break.
 */
export function phraseToPattern(phrase: string): string {
  return phrase.trim().split(/\s+/).map(escapeRegex).join("\\s+");
}
