import {
  ArrowLeft,
  AtSign,
  Box,
  Calendar,
  HardDrive,
  Home,
  Mail,
  User,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteUserButton } from "@/app/(app)/admin/_components/delete-user-button";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type DailyActivityStats, getUserDailyActivity } from "@/lib/activity";
import {
  getUserUsageBreakdown,
  type UserUsageBreakdown,
} from "@/lib/admin/usage-stats";
import db from "@/lib/db";
import { formatMemberNumber } from "@/lib/format-member-number";
import { cn, formatBytes, formatUsd, getUserInitials } from "@/lib/utils";

type PageParams = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: PageParams }) {
  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    select: { email: true, firstName: true, lastName: true },
  });

  const name = user
    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
    : "User";

  return { title: `${name} | Users | Admin | abode` };
}

function ActivityBreakdown({ activity }: { activity: DailyActivityStats[] }) {
  // Calculate totals
  const totals = activity.reduce(
    (acc, day) => ({
      itemsCreated: acc.itemsCreated + day.itemsCreated,
      itemsUpdated: acc.itemsUpdated + day.itemsUpdated,
      itemsDeleted: acc.itemsDeleted + day.itemsDeleted,
      itemsViewed: acc.itemsViewed + day.itemsViewed,
      roomsCreated: acc.roomsCreated + day.roomsCreated,
      roomsUpdated: acc.roomsUpdated + day.roomsUpdated,
      roomsDeleted: acc.roomsDeleted + day.roomsDeleted,
      roomsViewed: acc.roomsViewed + day.roomsViewed,
      logins: acc.logins + day.logins,
      userUpdates: acc.userUpdates + day.userUpdates,
    }),
    {
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
    },
  );

  const totalActions =
    totals.itemsCreated +
    totals.itemsUpdated +
    totals.itemsDeleted +
    totals.itemsViewed +
    totals.roomsCreated +
    totals.roomsUpdated +
    totals.roomsDeleted +
    totals.roomsViewed +
    totals.logins +
    totals.userUpdates;

  const activeDays = activity.filter(
    (day) =>
      day.itemsCreated +
        day.itemsUpdated +
        day.itemsDeleted +
        day.itemsViewed +
        day.roomsCreated +
        day.roomsUpdated +
        day.roomsDeleted +
        day.roomsViewed +
        day.logins +
        day.userUpdates >
      0,
  ).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activity (Last 14 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Summary</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total actions</span>
                <span className="font-medium">{totalActions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active days</span>
                <span className="font-medium">{activeDays} / 14</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Logins</span>
                <span className="font-medium">{totals.logins}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Items</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{totals.itemsCreated}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span>{totals.itemsUpdated}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deleted</span>
                <span>{totals.itemsDeleted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Viewed</span>
                <span>{totals.itemsViewed}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Rooms</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{totals.roomsCreated}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span>{totals.roomsUpdated}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deleted</span>
                <span>{totals.roomsDeleted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Viewed</span>
                <span>{totals.roomsViewed}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Account</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Profile updates</span>
                <span>{totals.userUpdates}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UsageCard({ usage }: { usage: UserUsageBreakdown }) {
  const overDaily = usage.totalCostUsd >= usage.dailyLimitUsd;
  const overMonthly = usage.monthCostUsd >= usage.monthlyLimitUsd;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI Usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Spend today</span>
          <span
            className={cn(
              "font-medium text-sm tabular-nums",
              overDaily && "text-destructive",
            )}
          >
            {formatUsd(usage.totalCostUsd)} / {formatUsd(usage.dailyLimitUsd)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">
            Spend this month
          </span>
          <span
            className={cn(
              "font-medium text-sm tabular-nums",
              overMonthly && "text-destructive",
            )}
          >
            {formatUsd(usage.monthCostUsd)} / {formatUsd(usage.monthlyLimitUsd)}
          </span>
        </div>
        {usage.overCap && (
          <p className="font-medium text-destructive text-xs">
            Over cap (daily or monthly)
          </p>
        )}
        <hr />
        <div className="space-y-1">
          {usage.buckets.map((bucket) => (
            <div
              key={bucket.bucket}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">{bucket.label}</span>
              <span
                className={cn(
                  "tabular-nums",
                  bucket.count >= bucket.limit &&
                    "font-medium text-destructive",
                )}
              >
                {bucket.count} / {bucket.limit}
              </span>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          Counts reset at UTC midnight; monthly spend resets on the 1st (UTC).
          Spend is the total across all AI operations (per-bucket spend isn't
          tracked separately).
        </p>
      </CardContent>
    </Card>
  );
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: PageParams;
}) {
  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      isAdmin: true,
      memberNumber: true,
      storageUsedBytes: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          items: true,
          rooms: true,
        },
      },
    },
  });

  if (!user) {
    notFound();
  }

  const [dailyActivity, usageBreakdown] = await Promise.all([
    getUserDailyActivity(id, 14),
    getUserUsageBreakdown(id),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <DashboardHeader />

      <div className="mx-auto w-full max-w-7xl px-4 py-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/users"
              className="rounded-md p-2 hover:bg-muted"
              aria-label="Back to users list"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div className="flex items-center gap-4">
              <Avatar className="size-12">
                <AvatarImage src={user.avatarUrl ?? undefined} />
                <AvatarFallback>
                  {getUserInitials(user.firstName, user.lastName, user.email)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-semibold text-2xl tracking-tight">
                  {user.firstName || user.lastName
                    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                    : user.email}
                  {user.isAdmin && (
                    <span className="ml-2 rounded bg-primary/10 px-2 py-1 font-medium text-primary text-sm">
                      Admin
                    </span>
                  )}
                </h2>
                <p className="text-muted-foreground text-sm">{user.email}</p>
              </div>
            </div>
          </div>
          <DeleteUserButton userId={user.id} userEmail={user.email} />
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* User Info */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Account Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Email</p>
                  <p className="text-sm">{user.email}</p>
                </div>
              </div>

              {user.username && (
                <div className="flex items-center gap-3">
                  <AtSign className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Username</p>
                    <Link
                      href={`/@${user.username}`}
                      className="text-sm hover:underline"
                    >
                      @{user.username}
                    </Link>
                  </div>
                </div>
              )}

              {(user.firstName || user.lastName) && (
                <div className="flex items-center gap-3">
                  <User className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Name</p>
                    <p className="text-sm">
                      {`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Calendar className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Joined</p>
                  <p className="text-sm">
                    {new Date(user.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  {user.memberNumber && (
                    <p className="text-muted-foreground text-xs">
                      Member #{formatMemberNumber(user.memberNumber)}
                    </p>
                  )}
                </div>
              </div>

              <hr />

              <div className="flex items-center gap-3">
                <Box className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Items</p>
                  <p className="font-medium text-sm">{user._count.items}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Home className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Rooms</p>
                  <p className="font-medium text-sm">{user._count.rooms}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <HardDrive className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Storage Used</p>
                  <p className="font-medium text-sm">
                    {formatBytes(user.storageUsedBytes)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity */}
          <div className="lg:col-span-2">
            <ActivityBreakdown activity={dailyActivity} />
          </div>

          {/* AI usage (today + month-to-date) */}
          <UsageCard usage={usageBreakdown} />
        </div>
      </div>
    </div>
  );
}
