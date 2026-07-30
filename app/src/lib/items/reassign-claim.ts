import db from "@/lib/db";
import { startOfUtcDay } from "@/lib/usage-limits";

/**
 * Atomically claim a reassignment of `itemId` (owned by `userId`): flip it to
 * `processing` and stamp today. The claim only matches an item that isn't
 * already `processing`, so at most one reassign is ever in flight per item —
 * two concurrent requests can't both win (the loser matches no rows), so a
 * losing request's revert can't clobber the winner's claim. Non-admins also get
 * one claim per item per UTC day; admins skip that daily gate but not the
 * single-in-flight one.
 *
 * Returns whether this request claimed it; callers must not trigger the paid
 * pipeline (or count usage) when it returns false.
 */
export async function claimDailyReassign(
  itemId: string,
  userId: string,
  isAdmin: boolean,
): Promise<boolean> {
  const { count } = await db.item.updateMany({
    where: isAdmin
      ? { id: itemId, userId, processingStatus: { not: "processing" } }
      : {
          id: itemId,
          userId,
          processingStatus: { not: "processing" },
          OR: [
            { lastReassignedAt: null },
            { lastReassignedAt: { lt: startOfUtcDay() } },
          ],
        },
    data: { processingStatus: "processing", lastReassignedAt: new Date() },
  });

  return count > 0;
}
