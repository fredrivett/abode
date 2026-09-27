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

/** Page count stored on a document's `meta` at save time (null if absent) */
export function documentPageCount(meta: unknown): number | null {
  if (typeof meta !== "object" || meta === null) return null;
  const count: unknown = Reflect.get(meta, "pageCount");
  return typeof count === "number" && Number.isInteger(count) && count > 0
    ? count
    : null;
}
