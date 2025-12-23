import type { ActivityType, Prisma } from "@prisma/client";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";

const log = createLogger("activity");

/**
 * Log a user activity. Fire-and-forget - errors are logged but don't throw.
 */
export async function logActivity(
  userId: string,
  type: ActivityType,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        userId,
        type,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    // Log but don't throw - activity logging shouldn't break main flows
    log.error({ error, userId, type }, "Failed to log activity");
  }
}

export type DailyActivityStats = {
  date: string; // YYYY-MM-DD
  itemsCreated: number;
  itemsUpdated: number;
  itemsDeleted: number;
  itemsViewed: number;
  roomsCreated: number;
  roomsUpdated: number;
  roomsDeleted: number;
  roomsViewed: number;
  logins: number;
  userUpdates: number;
};

/**
 * Get daily activity breakdown for a user over the last N days.
 * Used for the 14-day detailed view.
 */
export async function getUserDailyActivity(
  userId: string,
  days: number,
): Promise<DailyActivityStats[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const logs = await db.activityLog.findMany({
    where: {
      userId,
      createdAt: { gte: startDate },
    },
    select: {
      type: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by date
  const dailyMap = new Map<string, DailyActivityStats>();

  // Initialize all days
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    dailyMap.set(dateStr, {
      date: dateStr,
      itemsCreated: 0,
      itemsUpdated: 0,
      itemsDeleted: 0,
      itemsViewed: 0,
      roomsCreated: 0,
      roomsUpdated: 0,
      roomsDeleted: 0,
      roomsViewed: 0,
      logins: 0,
      userUpdates: 0,
    });
  }

  // Populate with actual data
  for (const log of logs) {
    const dateStr = log.createdAt.toISOString().split("T")[0];
    const stats = dailyMap.get(dateStr);
    if (!stats) continue;

    switch (log.type) {
      case "item_create":
        stats.itemsCreated++;
        break;
      case "item_update":
        stats.itemsUpdated++;
        break;
      case "item_delete":
        stats.itemsDeleted++;
        break;
      case "item_view":
        stats.itemsViewed++;
        break;
      case "room_create":
        stats.roomsCreated++;
        break;
      case "room_update":
        stats.roomsUpdated++;
        break;
      case "room_delete":
        stats.roomsDeleted++;
        break;
      case "room_view":
        stats.roomsViewed++;
        break;
      case "user_login":
        stats.logins++;
        break;
      case "user_update":
        stats.userUpdates++;
        break;
    }
  }

  // Return sorted by date descending (most recent first)
  return Array.from(dailyMap.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export type DailyOverview = {
  date: string; // YYYY-MM-DD
  active: boolean;
};

/**
 * Get activity overview for a user over the last N days.
 * Just indicates active/inactive per day. Used for 90-day heatmap.
 */
export async function getUserActivityOverview(
  userId: string,
  days: number,
): Promise<DailyOverview[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const logs = await db.activityLog.findMany({
    where: {
      userId,
      createdAt: { gte: startDate },
    },
    select: {
      createdAt: true,
    },
  });

  // Get unique active dates
  const activeDates = new Set<string>();
  for (const log of logs) {
    activeDates.add(log.createdAt.toISOString().split("T")[0]);
  }

  // Build overview for all days
  const overview: DailyOverview[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    overview.push({
      date: dateStr,
      active: activeDates.has(dateStr),
    });
  }

  return overview;
}

export type GlobalDailyStats = {
  date: string;
  totalActions: number;
  activeUsers: number;
};

/**
 * Get global daily activity stats across all users.
 * Used for admin dashboard overview.
 */
export async function getGlobalDailyActivity(
  days: number,
): Promise<GlobalDailyStats[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const logs = await db.activityLog.findMany({
    where: {
      createdAt: { gte: startDate },
    },
    select: {
      userId: true,
      createdAt: true,
    },
  });

  // Group by date
  const dailyMap = new Map<
    string,
    { totalActions: number; uniqueUsers: Set<string> }
  >();

  // Initialize all days
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    dailyMap.set(dateStr, { totalActions: 0, uniqueUsers: new Set() });
  }

  // Populate with actual data
  for (const log of logs) {
    const dateStr = log.createdAt.toISOString().split("T")[0];
    const stats = dailyMap.get(dateStr);
    if (!stats) continue;

    stats.totalActions++;
    stats.uniqueUsers.add(log.userId);
  }

  // Convert to array
  return Array.from(dailyMap.entries())
    .map(([date, stats]) => ({
      date,
      totalActions: stats.totalActions,
      activeUsers: stats.uniqueUsers.size,
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
