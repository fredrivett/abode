import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import {
  getDailyCostTrend,
  getGlobalUsageToday,
  getTopSpendersThisMonth,
} from "@/lib/admin/usage-stats";
import { formatUsd } from "@/lib/utils";
import { CostTrendChart } from "../../_components/cost-trend-chart";
import { TopSpendersTable } from "../../_components/top-spenders-table";

export const metadata = {
  title: "Costs | Admin | abode",
};

const TREND_DAYS = 30;
const TOP_SPENDERS = 10;

export default async function AdminCostsPage() {
  const [dailyCost, topSpenders, usage] = await Promise.all([
    getDailyCostTrend(TREND_DAYS),
    getTopSpendersThisMonth(TOP_SPENDERS),
    getGlobalUsageToday(),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <DashboardHeader />

      <div className="mx-auto w-full max-w-7xl px-4 py-8">
        <header className="flex items-center gap-4">
          <Link
            href="/admin"
            className="rounded-md p-2 hover:bg-muted"
            aria-label="Back to admin dashboard"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h2 className="font-semibold text-2xl tracking-tight">Costs</h2>
            <p className="mt-1 text-muted-foreground text-sm">
              {formatUsd(usage.totalCostUsd)} today (of{" "}
              {formatUsd(usage.systemDailyLimitUsd)}) ·{" "}
              {formatUsd(usage.totalMonthCostUsd)} this month ·{" "}
              {usage.enforced ? "enforced" : "shadow mode"}
            </p>
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <CostTrendChart dailyCost={dailyCost} />
          <TopSpendersTable spenders={topSpenders} />
        </div>
      </div>
    </div>
  );
}
