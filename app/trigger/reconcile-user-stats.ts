import { logger, schedules } from "@trigger.dev/sdk";
import db from "../src/lib/db";

/**
 * Daily reconciliation task for user stats (storage and item count).
 *
 * Recalculates storageUsedBytes and itemCount for all users by querying
 * their actual items. This ensures cached values stay in sync even if
 * there are edge cases (failed deletions, manual DB edits, etc.).
 */
export const reconcileUserStatsTask = schedules.task({
  id: "reconcile-user-stats",
  cron: "0 3 * * *", // Daily at 3:00 AM UTC
  run: async () => {
    logger.log("Starting user stats reconciliation");

    // Calculate actual storage and item count for all users in parallel queries
    const [storageByUser, itemCountByUser] = await Promise.all([
      db.$queryRaw<{ user_id: string; total: bigint | null }[]>`
        SELECT u.id as user_id, COALESCE(SUM((i.meta->>'size')::numeric::bigint), 0) as total
        FROM users u
        LEFT JOIN items i ON i.user_id = u.id AND jsonb_typeof(i.meta->'size') = 'number'
        GROUP BY u.id
      `,
      db.$queryRaw<{ user_id: string; total: bigint }[]>`
        SELECT u.id as user_id, COUNT(i.id) as total
        FROM users u
        LEFT JOIN items i ON i.user_id = u.id
        GROUP BY u.id
      `,
    ]);

    // Get current values for all users
    const users = await db.user.findMany({
      select: { id: true, storageUsedBytes: true, itemCount: true },
    });

    // Create lookup maps for actual values
    const actualStorageMap = new Map<string, bigint>();
    for (const row of storageByUser) {
      actualStorageMap.set(row.user_id, row.total ?? BigInt(0));
    }

    const actualItemCountMap = new Map<string, number>();
    for (const row of itemCountByUser) {
      actualItemCountMap.set(row.user_id, Number(row.total));
    }

    let storageUpdated = 0;
    let itemCountUpdated = 0;
    let skipped = 0;

    // Apply updates for users with discrepancies
    for (const user of users) {
      const actualStorage = actualStorageMap.get(user.id) ?? BigInt(0);
      const actualItemCount = actualItemCountMap.get(user.id) ?? 0;

      const storageChanged = actualStorage !== user.storageUsedBytes;
      const itemCountChanged = actualItemCount !== user.itemCount;

      if (storageChanged || itemCountChanged) {
        await db.user.update({
          where: { id: user.id },
          data: {
            ...(storageChanged && { storageUsedBytes: actualStorage }),
            ...(itemCountChanged && { itemCount: actualItemCount }),
          },
        });

        if (storageChanged) {
          logger.log("Fixed storage discrepancy", {
            userId: user.id,
            was: user.storageUsedBytes.toString(),
            now: actualStorage.toString(),
            delta: (actualStorage - user.storageUsedBytes).toString(),
          });
          storageUpdated++;
        }

        if (itemCountChanged) {
          logger.log("Fixed item count discrepancy", {
            userId: user.id,
            was: user.itemCount,
            now: actualItemCount,
            delta: actualItemCount - user.itemCount,
          });
          itemCountUpdated++;
        }
      } else {
        skipped++;
      }
    }

    logger.log("User stats reconciliation complete", {
      totalUsers: users.length,
      storageUpdated,
      itemCountUpdated,
      skipped,
    });

    return {
      success: true,
      totalUsers: users.length,
      storageUpdated,
      itemCountUpdated,
      skipped,
    };
  },
});
