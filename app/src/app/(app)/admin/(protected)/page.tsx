import Link from "next/link";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { getGlobalDailyActivity } from "@/lib/activity";
import db from "@/lib/db";
import { ActivityChart } from "../_components/activity-chart";
import { ActivityHeatmap } from "../_components/activity-heatmap";
import { StatsCards } from "../_components/stats-cards";

export default async function AdminPage() {
  // Get aggregate counts
  const [userCount, itemCount, roomCount, totalStorageResult] =
    await Promise.all([
      db.user.count(),
      db.item.count(),
      db.room.count(),
      db.user.aggregate({
        _sum: { storageUsedBytes: true },
      }),
    ]);

  const totalStorageBytes =
    totalStorageResult._sum.storageUsedBytes ?? BigInt(0);

  // Get 90-day activity (includes 14-day data as subset)
  const activityOverview = await getGlobalDailyActivity(90);

  // Slice the first 14 days for the chart (data is sorted by date descending)
  const dailyActivity = activityOverview.slice(0, 14);

  const totals = {
    users: userCount,
    items: itemCount,
    rooms: roomCount,
    storageBytes: totalStorageBytes.toString(),
  };

  const heatmapData = activityOverview.map((day) => ({
    date: day.date,
    active: day.totalActions > 0,
    totalActions: day.totalActions,
    activeUsers: day.activeUsers,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <DashboardHeader />

      <div className="mx-auto w-full max-w-7xl px-4 py-8">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Admin Dashboard
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Overview of platform usage and activity.
            </p>
          </div>
          <Link
            href="/admin/users"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            View Users
          </Link>
        </header>

        <div className="mt-8 space-y-6">
          <StatsCards totals={totals} />

          <div className="grid gap-6 lg:grid-cols-2">
            <ActivityChart dailyActivity={dailyActivity} />
            <ActivityHeatmap activityOverview={heatmapData} />
          </div>
        </div>
      </div>
    </div>
  );
}
