import type { Prisma } from "@prisma/client";

function positiveNumberField(meta: unknown, key: string): bigint {
  if (meta && typeof meta === "object" && key in meta) {
    const value = (meta as Record<string, unknown>)[key];
    if (typeof value === "number" && value > 0) {
      return BigInt(Math.floor(value));
    }
  }
  return BigInt(0);
}

/**
 * Logical storage bytes an item's meta accounts for. Mirrors the daily
 * reconciliation (reconcile-user-data), which sums meta.size (uploads/images)
 * and meta.coverSize (article/book/product/video covers).
 */
export function getItemStorageBytes(meta: unknown): bigint {
  return (
    positiveNumberField(meta, "size") + positiveNumberField(meta, "coverSize")
  );
}

/** Non-empty `fileKey` strings from a JSON array of media/image objects. */
function collectFileKeys(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  const keys: string[] = [];
  for (const entry of value) {
    if (entry && typeof entry === "object" && "fileKey" in entry) {
      const key = (entry as Record<string, unknown>).fileKey;
      if (typeof key === "string" && key.length > 0) keys.push(key);
    }
  }
  return keys;
}

/**
 * File keys of the images stored in an ItemProductDetails.images JSON blob.
 * A product stores several images, only the first of which is the cover.
 */
export function extractProductImageKeys(
  images: Prisma.JsonValue | null | undefined,
): string[] {
  return collectFileKeys(images);
}

/**
 * File keys of the images re-hosted for a tweet: each media still (photo or
 * video/gif poster) plus the link-card image. Like products, a tweet stores
 * several images; only the cover is accounted for in `meta.coverSize`, but all
 * of them must be deleted on reanalysis so they don't leak.
 */
export function extractTwitterImageKeys(
  media: Prisma.JsonValue | null | undefined,
  card: Prisma.JsonValue | null | undefined,
): string[] {
  const keys = collectFileKeys(media);
  if (card && typeof card === "object" && "imageFileKey" in card) {
    const key = (card as Record<string, unknown>).imageFileKey;
    if (typeof key === "string" && key.length > 0) keys.push(key);
  }
  return keys;
}

/**
 * File keys of the images re-hosted for an Instagram post: each media still.
 * Only the cover is accounted for in `meta.coverSize`, but all of them must be
 * deleted on reanalysis so they don't leak.
 */
export function extractInstagramImageKeys(
  media: Prisma.JsonValue | null | undefined,
): string[] {
  return collectFileKeys(media);
}

/**
 * The subset of an item's previous file keys to remove from storage:
 * de-duplicated and excluding any key still in use by the new data (new uploads
 * use fresh UUIDs, so `keepFileKeys` is a safety net rather than a common case).
 */
export function filesToRemove(
  oldFileKeys: string[],
  keepFileKeys: string[],
): string[] {
  const keep = new Set(keepFileKeys);
  return [...new Set(oldFileKeys)].filter((key) => !keep.has(key));
}
