import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { getGlobalDailyActivity } from "@/lib/activity";
import { getVisualEmbeddingCoverage } from "@/lib/admin/embedding-coverage";
import { getGlobalUsageToday } from "@/lib/admin/usage-stats";
import db from "@/lib/db";
import { cn, formatUsd } from "@/lib/utils";
import { ActivityChart } from "../_components/activity-chart";
import { ActivityHeatmap } from "../_components/activity-heatmap";
import { StatsCards } from "../_components/stats-cards";

export const metadata = {
  title: "Admin | abode",
};

export default async function AdminPage() {
  // Get aggregate counts
  const [
    userCount,
    itemCount,
    roomCount,
    totalStorageResult,
    embeddings,
    usage,
  ] = await Promise.all([
    db.user.count(),
    db.item.count(),
    db.room.count(),
    db.user.aggregate({
      _sum: { storageUsedBytes: true },
    }),
    getVisualEmbeddingCoverage(),
    getGlobalUsageToday(),
  ]);

  const totalStorageBytes =
    totalStorageResult._sum.storageUsedBytes ?? BigInt(0);

  // Banner state for the system daily $ breaker: warn near it, alarm at/over.
  const systemPct =
    usage.systemDailyLimitUsd > 0
      ? usage.totalCostUsd / usage.systemDailyLimitUsd
      : 0;
  const systemSpendAlert: "over" | "near" | null =
    systemPct >= 1 ? "over" : systemPct >= 0.8 ? "near" : null;

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
            <h2 className="font-semibold text-2xl tracking-tight">
              Admin Dashboard
            </h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Overview of platform usage and activity.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/costs"
              className="rounded-md border px-4 py-2 font-medium text-sm hover:bg-muted"
            >
              Costs
            </Link>
            <Link
              href="/admin/processing"
              className="rounded-md border px-4 py-2 font-medium text-sm hover:bg-muted"
            >
              Processing
            </Link>
            <Link
              href="/admin/waitlist"
              className="rounded-md border px-4 py-2 font-medium text-sm hover:bg-muted"
            >
              Waitlist
            </Link>
            <Link
              href="/admin/invites"
              className="rounded-md border px-4 py-2 font-medium text-sm hover:bg-muted"
            >
              Invites
            </Link>
            <Link
              href="/admin/users"
              className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
            >
              View Users
            </Link>
          </div>
        </header>

        <div className="mt-8 space-y-6">
          {systemSpendAlert && (
            <div
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4",
                systemSpendAlert === "over"
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-500",
              )}
              role="alert"
            >
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold">
                  {systemSpendAlert === "over"
                    ? "System daily spend cap reached"
                    : "System daily spend approaching the cap"}
                </p>
                <p>
                  {formatUsd(usage.totalCostUsd)} of{" "}
                  {formatUsd(usage.systemDailyLimitUsd)} today
                  {usage.enforced
                    ? systemSpendAlert === "over"
                      ? " — new paid actions are being blocked platform-wide."
                      : " — the breaker will block all new paid actions at 100%."
                    : " — enforcement is off (shadow), so nothing is blocked."}
                </p>
              </div>
            </div>
          )}

          <StatsCards totals={totals} embeddings={embeddings} usage={usage} />

          <div className="grid gap-6 lg:grid-cols-2">
            <ActivityChart dailyActivity={dailyActivity} />
            <ActivityHeatmap activityOverview={heatmapData} />
          </div>
        </div>
      </div>
    </div>
  );
}
