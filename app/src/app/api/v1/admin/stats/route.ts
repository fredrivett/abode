import { NextResponse } from "next/server";
import { getGlobalDailyActivity } from "@/lib/activity";
import { hasFullAdminAccess } from "@/lib/admin/auth";
import { getVisualEmbeddingCoverage } from "@/lib/admin/embedding-coverage";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/v1/admin/stats");

/**
 * GET /api/v1/admin/stats - Get global stats and activity overview
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Check admin access with MFA
    const hasAccess = await hasFullAdminAccess(supabase);
    if (!hasAccess) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Get aggregate counts
    const [userCount, itemCount, roomCount, totalStorageResult, embeddings] =
      await Promise.all([
        db.user.count(),
        db.item.count(),
        db.room.count(),
        db.user.aggregate({
          _sum: { storageUsedBytes: true },
        }),
        getVisualEmbeddingCoverage(),
      ]);

    const totalStorageBytes =
      totalStorageResult._sum.storageUsedBytes ?? BigInt(0);

    // Get 14-day activity for chart
    const dailyActivity = await getGlobalDailyActivity(14);

    // Get 90-day activity overview for heatmap
    const activityOverview = await getGlobalDailyActivity(90);

    return NextResponse.json({
      totals: {
        users: userCount,
        items: itemCount,
        rooms: roomCount,
        storageBytes: totalStorageBytes.toString(),
      },
      embeddings,
      dailyActivity,
      activityOverview: activityOverview.map((day) => ({
        date: day.date,
        active: day.totalActions > 0,
        totalActions: day.totalActions,
        activeUsers: day.activeUsers,
      })),
    });
  } catch (error) {
    log.error({ error }, "Admin stats error");
    captureServerException(error, undefined, {
      route: "GET /api/v1/admin/stats",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
