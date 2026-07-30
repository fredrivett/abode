import db from "@/lib/db";
import { startOfUtcDay } from "@/lib/usage-limits";

/**
 * Atomically claim a reassignment of `itemId` (owned by `userId`), stamping it
 * `processing` and recording today as its last reassign. Non-admins get one
 * claim per item per UTC day; admins are exempt.
 *
 * The gate is a single conditional UPDATE, which Postgres re-evaluates under the
 * row lock, so two concurrent requests can't both claim — the loser matches no
 * rows. Returns whether this request won the claim; callers must not trigger the
 * paid pipeline (or count usage) when it returns false.
 */
export async function claimDailyReassign(
  itemId: string,
  userId: string,
  isAdmin: boolean,
): Promise<boolean> {
  const { count } = await db.item.updateMany({
    where: isAdmin
      ? { id: itemId, userId }
      : {
          id: itemId,
          userId,
          OR: [
            { lastReassignedAt: null },
            { lastReassignedAt: { lt: startOfUtcDay() } },
          ],
        },
    data: { processingStatus: "processing", lastReassignedAt: new Date() },
  });

  return count > 0;
}
