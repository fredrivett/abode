import { logger, schedules } from "@trigger.dev/sdk";
import db from "../src/lib/db";

/**
 * Daily reconciliation task for user data.
 *
 * Reconciles:
 * 1. Storage and item counts - ensures cached values match actual data
 * 2. Email sync - ensures DB email matches Supabase auth email (source of truth)
 */
export const reconcileUserDataTask = schedules.task({
  id: "reconcile-user-data",
  cron: "0 3 * * *", // Daily at 3:00 AM UTC
  run: async () => {
    logger.log("Starting user data reconciliation");

    // === Email Reconciliation ===
    // Find users where DB email doesn't match auth email (case-insensitive)
    const emailMismatches = await db.$queryRaw<
      { id: string; db_email: string; auth_email: string }[]
    >`
      SELECT u.id, u.email as db_email, au.email as auth_email
      FROM users u
      JOIN auth.users au ON u.id = au.id
      WHERE LOWER(u.email) != LOWER(au.email)
    `;

    let emailsFixed = 0;
    let emailErrors = 0;
    for (const mismatch of emailMismatches) {
      try {
        await db.user.update({
          where: { id: mismatch.id },
          data: { email: mismatch.auth_email.toLowerCase() },
        });
        logger.log("Fixed email mismatch", {
          userId: mismatch.id,
          was: mismatch.db_email,
          now: mismatch.auth_email,
        });
        emailsFixed++;
      } catch (error) {
        logger.error("Failed to fix email mismatch", {
          userId: mismatch.id,
          error,
        });
        emailErrors++;
      }
    }

    // === Storage & Item Count Reconciliation ===
    // Calculate actual storage and item count for all users in parallel queries
    // Storage calculation includes both meta.size (for images) and meta.coverSize (for article covers)
    const [storageByUser, itemCountByUser] = await Promise.all([
      db.$queryRaw<{ user_id: string; total: bigint | null }[]>`
        SELECT u.id as user_id, COALESCE(SUM(
          COALESCE(CASE WHEN jsonb_typeof(i.meta->'size') = 'number' THEN (i.meta->>'size')::numeric::bigint ELSE 0 END, 0) +
          COALESCE(CASE WHEN jsonb_typeof(i.meta->'coverSize') = 'number' THEN (i.meta->>'coverSize')::numeric::bigint ELSE 0 END, 0)
        ), 0) as total
        FROM users u
        LEFT JOIN items i ON i.user_id = u.id
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
    // Note: Prisma $queryRaw returns bigint as Decimal, so we must convert explicitly
    const actualStorageMap = new Map<string, bigint>();
    for (const row of storageByUser) {
      actualStorageMap.set(row.user_id, BigInt(row.total?.toString() ?? "0"));
    }

    const actualItemCountMap = new Map<string, number>();
    for (const row of itemCountByUser) {
      actualItemCountMap.set(row.user_id, Number(row.total));
    }

    let storageUpdated = 0;
    let itemCountUpdated = 0;
    let statsErrors = 0;
    let skipped = 0;

    // Apply updates for users with discrepancies
    for (const user of users) {
      const actualStorage = actualStorageMap.get(user.id) ?? BigInt(0);
      const actualItemCount = actualItemCountMap.get(user.id) ?? 0;

      const storageChanged = actualStorage !== user.storageUsedBytes;
      const itemCountChanged = actualItemCount !== user.itemCount;

      if (storageChanged || itemCountChanged) {
        try {
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
        } catch (error) {
          logger.error("Failed to fix stats discrepancy", {
            userId: user.id,
            error,
          });
          statsErrors++;
        }
      } else {
        skipped++;
      }
    }

    logger.log("User data reconciliation complete", {
      totalUsers: users.length,
      emailsFixed,
      emailErrors,
      storageUpdated,
      itemCountUpdated,
      statsErrors,
      skipped,
    });

    return {
      success: emailErrors === 0 && statsErrors === 0,
      totalUsers: users.length,
      emailsFixed,
      emailErrors,
      storageUpdated,
      itemCountUpdated,
      statsErrors,
      skipped,
    };
  },
});
