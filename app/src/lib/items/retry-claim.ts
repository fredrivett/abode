import db from "@/lib/db";

/**
 * Atomically claim a non-admin retry: flip `itemId` (owned by `userId`) from
 * `failed` to `processing`. Only one concurrent request wins — the conditional
 * UPDATE is re-checked under the row lock, so the loser matches no rows and must
 * NOT trigger the paid pipeline. Returns whether this request claimed it.
 */
export async function claimFailedRetry(
  itemId: string,
  userId: string,
): Promise<boolean> {
  const { count } = await db.item.updateMany({
    where: { id: itemId, userId, processingStatus: "failed" },
    data: { processingStatus: "processing", processingError: null },
  });

  return count > 0;
}
