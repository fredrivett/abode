"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyCost } from "@/lib/admin/usage-stats";
import { formatUsd } from "@/lib/utils";

type CostTrendChartProps = {
  /** Oldest→newest daily spend (dense). */
  dailyCost: DailyCost[];
};

export function CostTrendChart({ dailyCost }: CostTrendChartProps) {
  const maxCost = Math.max(...dailyCost.map((d) => d.costUsd), 0);
  const days = dailyCost.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          AI Spend (Last {days} Days){" "}
          <span className="font-normal text-muted-foreground text-xs">UTC</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-40 items-end gap-1">
          {dailyCost.map((day) => {
            // Scale to the busiest day; guard divide-by-zero when all are zero.
            const height = maxCost > 0 ? (day.costUsd / maxCost) * 100 : 0;
            const date = new Date(day.date);
            const dayLabel = date.toLocaleDateString("en-US", {
              day: "numeric",
            });

            return (
              <div
                key={day.date}
                className="group relative flex flex-1 flex-col items-center"
              >
                <div
                  className="min-h-1 w-full rounded-t bg-primary transition-all group-hover:bg-primary/80"
                  style={{ height: `${Math.max(height, 2)}%` }}
                />
                <span className="mt-1 text-[10px] text-muted-foreground">
                  {dayLabel}
                </span>

                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden whitespace-nowrap rounded bg-popover px-2 py-1 text-xs shadow-md group-hover:block">
                  <div className="font-medium">{day.date}</div>
                  <div>{formatUsd(day.costUsd)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
