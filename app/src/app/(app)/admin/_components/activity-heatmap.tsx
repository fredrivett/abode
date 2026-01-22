"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ActivityDay = {
  date: string;
  active: boolean;
  totalActions: number;
  activeUsers: number;
};

type ActivityHeatmapProps = {
  activityOverview: ActivityDay[];
};

function getIntensityClass(totalActions: number): string {
  if (totalActions === 0) return "bg-muted";
  if (totalActions < 5) return "bg-green-200 dark:bg-green-900";
  if (totalActions < 20) return "bg-green-400 dark:bg-green-700";
  if (totalActions < 50) return "bg-green-500 dark:bg-green-600";
  return "bg-green-600 dark:bg-green-500";
}

export function ActivityHeatmap({ activityOverview }: ActivityHeatmapProps) {
  // Reverse to show oldest first
  const data = [...activityOverview].reverse();

  // Group by weeks (7 days each)
  const weeks: ActivityDay[][] = [];
  for (let i = 0; i < data.length; i += 7) {
    weeks.push(data.slice(i, i + 7));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Activity Overview (90 Days){" "}
          <span className="font-normal text-muted-foreground text-xs">UTC</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1">
          {weeks.map((week) => (
            <div key={week[0]?.date ?? "empty"} className="flex flex-col gap-1">
              {week.map((day) => (
                <div
                  key={day.date}
                  className={`group relative size-3 rounded-sm ${getIntensityClass(day.totalActions)}`}
                  title={`${day.date}: ${day.totalActions} actions, ${day.activeUsers} users`}
                >
                  {/* Tooltip */}
                  <div className="-translate-x-1/2 absolute bottom-full left-1/2 z-10 mb-2 hidden whitespace-nowrap rounded bg-popover px-2 py-1 text-xs shadow-md group-hover:block">
                    <div className="font-medium">{day.date}</div>
                    <div>{day.totalActions} actions</div>
                    <div>{day.activeUsers} users</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-2 text-muted-foreground text-xs">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="size-3 rounded-sm bg-muted" />
            <div className="size-3 rounded-sm bg-green-200 dark:bg-green-900" />
            <div className="size-3 rounded-sm bg-green-400 dark:bg-green-700" />
            <div className="size-3 rounded-sm bg-green-500 dark:bg-green-600" />
            <div className="size-3 rounded-sm bg-green-600 dark:bg-green-500" />
          </div>
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}
