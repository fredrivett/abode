/** One page of a document as the viewer needs it (see GET …/[id]/pages) */
export interface DocumentPageSummary {
  position: number;
  fileKey: string;
  width: number;
  height: number;
}

export interface DocumentPagesResponse {
  pages: DocumentPageSummary[];
}

/**
 * Most pages of one document that are OCR'd. A scan (MAX_DOCUMENT_PAGES) never
 * reaches it; a long scanned PDF's later pages stay viewable but unsearchable,
 * bounding the spend one upload can trigger.
 */
export const MAX_OCR_PAGES_PER_DOCUMENT = 30;

/** Page count stored on a document's `meta` at save time (null if absent) */
export function documentPageCount(meta: unknown): number | null {
  if (typeof meta !== "object" || meta === null) return null;
  const count: unknown = Reflect.get(meta, "pageCount");
  return typeof count === "number" && Number.isInteger(count) && count > 0
    ? count
    : null;
}

/**
 * Scanned pages left without text (past the OCR cap, or the daily allowance),
 * stored on a document's `meta` by its analysis. 0 when none or absent.
 */
export function documentOcrSkippedPages(meta: unknown): number {
  if (typeof meta !== "object" || meta === null) return 0;
  const count: unknown = Reflect.get(meta, "ocrSkippedPages");
  return typeof count === "number" && Number.isInteger(count) && count > 0
    ? count
    : 0;
}
