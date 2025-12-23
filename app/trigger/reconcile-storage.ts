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

    // Get all users who have items
    const users = await db.user.findMany({
      select: { id: true, storageUsedBytes: true },
    });

    let updated = 0;
    let skipped = 0;

    for (const user of users) {
      // Calculate actual storage from items
      const result = await db.$queryRaw<[{ total: bigint | null }]>`
        SELECT SUM((meta->>'size')::bigint) as total
        FROM items
        WHERE user_id = ${user.id}::uuid
        AND deleted_at IS NULL
        AND meta->>'size' IS NOT NULL
      `;

      const actualBytes = result[0]?.total ?? BigInt(0);
      const currentBytes = user.storageUsedBytes;

      // Only update if there's a discrepancy
      if (actualBytes !== currentBytes) {
        await db.user.update({
          where: { id: user.id },
          data: { storageUsedBytes: actualBytes },
        });

        logger.log("Fixed storage discrepancy", {
          userId: user.id,
          was: currentBytes.toString(),
          now: actualBytes.toString(),
          delta: (actualBytes - currentBytes).toString(),
        });

        updated++;
      } else {
        skipped++;
      }
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
