import type { Prisma } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@trigger.dev/sdk";
import {
  extractProductImageKeys,
  getItemStorageBytes,
} from "../src/lib/item-storage";

/**
 * Within `tx`, reclaim the storage an item is about to overwrite.
 *
 * Reanalysis re-downloads covers/images and each handler increments the user's
 * storage by the new bytes. Without this the previous cover's bytes were never
 * decremented, so repeated reanalysis inflated the accounting. Here we apply the
 * *net* change (new − old) and return the previous file keys so the caller can
 * delete the now-orphaned blobs once the transaction commits.
 *
 * Must run before the item row is updated so it reads the item's previous meta
 * and detail rows.
 */
export async function reclaimReplacedStorage(
  tx: Prisma.TransactionClient,
  {
    itemId,
    userId,
    addedBytes,
  }: { itemId: string; userId: string; addedBytes: number },
): Promise<string[]> {
  const existing = await tx.item.findUnique({
    where: { id: itemId },
    select: {
      meta: true,
      fileKey: true,
      coverFileKey: true,
      productDetails: { select: { images: true } },
    },
  });
  if (!existing) return [];

  const oldBytes = getItemStorageBytes(existing.meta);
  const delta = BigInt(addedBytes) - oldBytes;
  if (delta !== BigInt(0)) {
    await tx.user.update({
      where: { id: userId },
      data: { storageUsedBytes: { increment: delta } },
    });
  }

  return [
    existing.fileKey,
    existing.coverFileKey,
    ...extractProductImageKeys(existing.productDetails?.images),
  ].filter((key): key is string => typeof key === "string" && key.length > 0);
}

/**
 * Best-effort deletion of an item's previous blobs after its storage has been
 * reclaimed. Keys still in use by the new data (`keepFileKeys`) are never
 * removed. Failures are logged, not thrown — a leaked blob is better than
 * failing an otherwise successful reanalysis.
 */
export async function deleteReplacedFiles(
  supabase: SupabaseClient,
  oldFileKeys: string[],
  keepFileKeys: string[],
): Promise<void> {
  const keep = new Set(keepFileKeys);
  const toRemove = [...new Set(oldFileKeys)].filter((key) => !keep.has(key));
  if (toRemove.length === 0) return;

  const { error } = await supabase.storage.from("items").remove(toRemove);
  if (error) {
    logger.warn("Failed to delete replaced item files from storage", {
      error,
      fileKeys: toRemove,
    });
  }
}
