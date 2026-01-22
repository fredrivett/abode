"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GlobalDailyStats } from "@/lib/activity";

type ActivityChartProps = {
  dailyActivity: GlobalDailyStats[];
};

export function ActivityChart({ dailyActivity }: ActivityChartProps) {
  // Reverse to show oldest first (left to right)
  const data = [...dailyActivity].reverse();

  const maxActions = Math.max(...data.map((d) => d.totalActions), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Activity (Last 14 Days){" "}
          <span className="font-normal text-muted-foreground text-xs">UTC</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-40 items-end gap-1">
          {data.map((day) => {
            const height = (day.totalActions / maxActions) * 100;
            const date = new Date(day.date);
            const dayName = date.toLocaleDateString("en-US", {
              weekday: "short",
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
                  {dayName}
                </span>

                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden rounded bg-popover px-2 py-1 text-xs shadow-md group-hover:block">
                  <div className="font-medium">{day.date}</div>
                  <div>{day.totalActions} actions</div>
                  <div>{day.activeUsers} users</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
