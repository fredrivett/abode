import { logger, schedules } from "@trigger.dev/sdk";
import db from "../src/lib/db";

/**
 * Daily reconciliation task for user storage usage.
 *
 * Recalculates storageUsedBytes for all users by summing the file sizes
 * from their items. This ensures the cached value stays in sync even if
 * there are edge cases (failed deletions, manual DB edits, etc.).
 */
export const reconcileStorageTask = schedules.task({
  id: "reconcile-storage",
  cron: "0 3 * * *", // Daily at 3:00 AM UTC
  run: async () => {
    logger.log("Starting storage reconciliation");

    // Calculate actual storage for all users in a single query
    const storageByUser = await db.$queryRaw<
      { user_id: string; total: bigint | null }[]
    >`
      SELECT u.id as user_id, COALESCE(SUM((i.meta->>'size')::bigint), 0) as total
      FROM users u
      LEFT JOIN items i ON i.user_id = u.id AND i.deleted_at IS NULL AND i.meta->>'size' IS NOT NULL
      GROUP BY u.id
    `;

    // Get current storage values for all users
    const users = await db.user.findMany({
      select: { id: true, storageUsedBytes: true },
    });

    // Create lookup map for actual storage
    const actualStorageMap = new Map<string, bigint>();
    for (const row of storageByUser) {
      actualStorageMap.set(row.user_id, row.total ?? BigInt(0));
    }

    let updated = 0;
    let skipped = 0;

    // Batch updates for users with discrepancies
    const updates: { id: string; actualBytes: bigint; currentBytes: bigint }[] =
      [];

    for (const user of users) {
      const actualBytes = actualStorageMap.get(user.id) ?? BigInt(0);
      const currentBytes = user.storageUsedBytes;

      if (actualBytes !== currentBytes) {
        updates.push({ id: user.id, actualBytes, currentBytes });
      } else {
        skipped++;
      }
    }

    // Apply updates
    for (const update of updates) {
      await db.user.update({
        where: { id: update.id },
        data: { storageUsedBytes: update.actualBytes },
      });

      logger.log("Fixed storage discrepancy", {
        userId: update.id,
        was: update.currentBytes.toString(),
        now: update.actualBytes.toString(),
        delta: (update.actualBytes - update.currentBytes).toString(),
      });

      updated++;
    }

    logger.log("Storage reconciliation complete", {
      totalUsers: users.length,
      updated,
      skipped,
    });

    return {
      success: true,
      totalUsers: users.length,
      updated,
      skipped,
    };
  },
});
