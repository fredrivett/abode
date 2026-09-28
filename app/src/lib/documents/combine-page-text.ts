/**
 * Cap on a document's combined OCR text kept at item level. It's searched with
 * an on-the-fly `to_tsvector`, which errors past 1MB; the full text of every
 * page stays on its own `item_document_pages.ocr_text` row regardless.
 */
export const DOCUMENT_TEXT_MAX_CHARS = 200_000;

/**
 * One text for the whole document: the pages' OCR text in reading order,
 * separated by blank lines, skipping pages with no text. Null when no page has
 * text. Truncated to `maxChars`.
 */
export function combinePageText({
  pages,
  maxChars = DOCUMENT_TEXT_MAX_CHARS,
}: {
  pages: { position: number; ocrText: string | null }[];
  maxChars?: number;
}): string | null {
  const text = [...pages]
    .sort((a, b) => a.position - b.position)
    .map((page) => page.ocrText?.trim())
    .filter((pageText): pageText is string => Boolean(pageText))
    .join("\n\n");
  if (!text) return null;
  if (text.length <= maxChars) return text;
  // Cut on code points, so the cap never splits a character (e.g. an emoji)
  return [...text].slice(0, maxChars).join("");
}
