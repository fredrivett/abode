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

/**
 * File keys of the images stored in an ItemProductDetails.images JSON blob.
 * A product stores several images, only the first of which is the cover.
 */
export function extractProductImageKeys(
  images: Prisma.JsonValue | null | undefined,
): string[] {
  if (!Array.isArray(images)) return [];
  const keys: string[] = [];
  for (const image of images) {
    if (image && typeof image === "object" && "fileKey" in image) {
      const key = (image as Record<string, unknown>).fileKey;
      if (typeof key === "string" && key.length > 0) keys.push(key);
    }
  }
  return keys;
}
