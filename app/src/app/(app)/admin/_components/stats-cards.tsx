"use client";

import {
  AlertTriangle,
  Box,
  CalendarDays,
  DollarSign,
  HardDrive,
  Home,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatBytes, formatUsd } from "@/lib/utils";

/** Fraction of the system daily cap at/above which we flag "near the breaker". */
const SYSTEM_NEAR_CAP_FRACTION = 0.8;

type StatsCardsProps = {
  totals: {
    users: number;
    items: number;
    rooms: number;
    storageBytes: string;
  };
  embeddings?: {
    imageItems: number;
    withEmbeddings: number;
  };
  usage?: {
    totalCostUsd: number;
    totalMonthCostUsd: number;
    usersOverCap: number;
    systemDailyLimitUsd: number;
    enforced: boolean;
  };
};

export function StatsCards({ totals, embeddings, usage }: StatsCardsProps) {
  const coveragePct =
    embeddings && embeddings.imageItems > 0
      ? Math.round((embeddings.withEmbeddings / embeddings.imageItems) * 100)
      : null;

  const systemPct =
    usage && usage.systemDailyLimitUsd > 0
      ? usage.totalCostUsd / usage.systemDailyLimitUsd
      : 0;
  const systemOverCap = usage ? systemPct >= 1 : false;
  const systemNearCap = usage
    ? systemPct >= SYSTEM_NEAR_CAP_FRACTION && !systemOverCap
    : false;
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-medium text-sm">Total Users</CardTitle>
          <Users className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="font-bold text-2xl">
            {totals.users.toLocaleString()}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-medium text-sm">Total Items</CardTitle>
          <Box className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="font-bold text-2xl">
            {totals.items.toLocaleString()}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-medium text-sm">Total Rooms</CardTitle>
          <Home className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="font-bold text-2xl">
            {totals.rooms.toLocaleString()}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-medium text-sm">Storage Used</CardTitle>
          <HardDrive className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="font-bold text-2xl">
            {formatBytes(BigInt(totals.storageBytes))}
          </div>
        </CardContent>
      </Card>

      {usage && (
        <>
          <Card
            className={cn(
              systemOverCap && "border-destructive",
              systemNearCap && "border-amber-500",
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">
                AI Spend Today
              </CardTitle>
              <DollarSign
                className={cn(
                  "size-4",
                  systemOverCap
                    ? "text-destructive"
                    : systemNearCap
                      ? "text-amber-500"
                      : "text-muted-foreground",
                )}
              />
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "font-bold text-2xl",
                  systemOverCap && "text-destructive",
                  systemNearCap && "text-amber-500",
                )}
              >
                {formatUsd(usage.totalCostUsd)}
                <span className="ml-1 font-normal text-muted-foreground text-sm">
                  / {formatUsd(usage.systemDailyLimitUsd)}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground text-xs">
                {systemOverCap
                  ? "system daily breaker tripped"
                  : `${Math.round(systemPct * 100)}% of the system daily breaker`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">
                AI Spend This Month
              </CardTitle>
              <CalendarDays className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">
                {formatUsd(usage.totalMonthCostUsd)}
              </div>
              <p className="mt-1 text-muted-foreground text-xs">
                across all users, resets on the 1st (UTC)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">
                Users Over Cap
              </CardTitle>
              <AlertTriangle
                className={cn(
                  "size-4",
                  usage.usersOverCap > 0
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              />
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "font-bold text-2xl",
                  usage.usersOverCap > 0 && "text-destructive",
                )}
              >
                {usage.usersOverCap.toLocaleString()}
              </div>
              <p className="mt-1 text-muted-foreground text-xs">
                over a daily or monthly cap
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">
                Limit Enforcement
              </CardTitle>
              {usage.enforced ? (
                <ShieldCheck className="size-4 text-emerald-500" />
              ) : (
                <ShieldAlert className="size-4 text-amber-500" />
              )}
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "font-bold text-2xl",
                  usage.enforced ? "text-emerald-500" : "text-amber-500",
                )}
              >
                {usage.enforced ? "Enforced" : "Shadow"}
              </div>
              <p className="mt-1 text-muted-foreground text-xs">
                {usage.enforced
                  ? "over-cap actions are blocked"
                  : "counted + logged, not blocked"}
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {embeddings && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">
              Image Embedding Coverage
            </CardTitle>
            <Sparkles className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {coveragePct === null ? "—" : `${coveragePct}%`}
            </div>
            <p className="mt-1 text-muted-foreground text-xs">
              {embeddings.withEmbeddings.toLocaleString()} of{" "}
              {embeddings.imageItems.toLocaleString()} images
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
