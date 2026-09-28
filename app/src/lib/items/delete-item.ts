import db from "@/lib/db";
import { collectItemFileKeys, itemFileKeysSelect } from "@/lib/item-storage";
import { createLogger } from "@/lib/logger.server";
import type { createClient } from "@/lib/supabase/server";
import { getFileSizeFromMeta } from "@/lib/utils";

const log = createLogger("lib/items/delete-item");

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type DeleteItemResult = "deleted" | "not_found" | "forbidden";

/**
 * Deletes one of the user's items: every stored file it owns (upload, cover,
 * favicon, re-hosted gallery/tweet/Instagram images, document pages — see
 * itemFileKeysSelect), the row (details and pages cascade), and the user's
 * item/storage counters — so every delete route behaves the same. A storage
 * error is logged and the row still deleted.
 */
export async function deleteOwnedItem({
  supabase,
  itemId,
  userId,
}: {
  supabase: SupabaseServerClient;
  itemId: string;
  userId: string;
}): Promise<DeleteItemResult> {
  const item = await db.item.findUnique({
    where: { id: itemId },
    select: { userId: true, meta: true, ...itemFileKeysSelect },
  });
  if (!item) return "not_found";
  if (item.userId !== userId) return "forbidden";

  const storageKeys = collectItemFileKeys(item);
  if (storageKeys.length > 0) {
    const { error } = await supabase.storage.from("items").remove(storageKeys);
    if (error) {
      log.error({ itemId, error }, "Storage deletion error");
    }
  }

  const fileSize = getFileSizeFromMeta(item.meta);
  await db.$transaction(async (tx) => {
    await tx.item.delete({ where: { id: itemId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        itemCount: { decrement: 1 },
        ...(fileSize > 0 && { storageUsedBytes: { decrement: fileSize } }),
      },
    });
  });
  return "deleted";
}
