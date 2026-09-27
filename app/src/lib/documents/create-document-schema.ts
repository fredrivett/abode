import { z } from "zod";

/**
 * Most pages one scanned document may have. Bounds the work (and AI spend) a
 * single save can trigger — every page is OCR'd.
 */
export const MAX_DOCUMENT_PAGES = 30;

const pageSchema = z.object({
  /** The page as displayed (filter + rotation applied) */
  fileKey: z.string().min(1),
  /** The flattened colour page (same key as `fileKey` for colour pages) */
  originalFileKey: z.string().min(1),
  filter: z.enum(["bw", "grey", "original"]),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /** Bytes uploaded for this page (both files), for storage accounting */
  size: z.number().int().nonnegative(),
});

/** Body of `POST /api/v1/items/documents`: pages in reading order */
export const createDocumentSchema = z.object({
  pages: z.array(pageSchema).min(1).max(MAX_DOCUMENT_PAGES),
  /** Tiny blurred placeholder of page 1 for the grid card */
  blurDataUrl: z.string().startsWith("data:image/").max(10_000).optional(),
});

export type CreateDocumentBody = z.infer<typeof createDocumentSchema>;

/** Every storage key a document references (displayed + originals, deduped) */
export function documentFileKeys(
  pages: readonly { fileKey: string; originalFileKey: string }[],
): string[] {
  return [
    ...new Set(pages.flatMap((page) => [page.fileKey, page.originalFileKey])),
  ];
}
