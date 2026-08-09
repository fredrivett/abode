import type { ItemKind } from "@prisma/client";

/**
 * Kinds that render a custom card or display via `coverFileKey`, so a null
 * primary `fileKey` is expected — they must never show the "missing file"
 * error. Only an uploaded `image` genuinely requires a `fileKey`.
 */
const NON_FILE_KINDS: readonly ItemKind[] = [
  "article",
  "webpage",
  "twitter",
  "instagram",
  "video",
  "note",
  "book",
  "product",
];

/**
 * Whether a grid card should show the red "Missing file" error.
 *
 * Only true for a resolved, non-processing item whose kind genuinely requires a
 * primary file (an uploaded image) that is absent. Notably returns false while
 * `kind` is still null: the lightweight status poll can flip an item to
 * `completed` before the full item (carrying its kind + cover) arrives, and a
 * premature error would flash until the refetch lands.
 */
export function shouldShowMissingFile(params: {
  kind: ItemKind | null;
  hasImageFileKey: boolean;
  isProcessingUrl: boolean;
  isFailedUrl: boolean;
}): boolean {
  const { kind, hasImageFileKey, isProcessingUrl, isFailedUrl } = params;
  if (hasImageFileKey) return false;
  if (kind === null) return false;
  if (isProcessingUrl || isFailedUrl) return false;
  return !NON_FILE_KINDS.includes(kind);
}
