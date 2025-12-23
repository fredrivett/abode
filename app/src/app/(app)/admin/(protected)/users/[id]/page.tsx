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
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type DailyActivityStats, getUserDailyActivity } from "@/lib/activity";
import db from "@/lib/db";
import { formatBytes, getUserInitials } from "@/lib/utils";

type PageParams = Promise<{ id: string }>;

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
            <h4 className="text-sm font-medium">Summary</h4>
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
            <h4 className="text-sm font-medium">Items</h4>
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
            <h4 className="text-sm font-medium">Rooms</h4>
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
            <h4 className="text-sm font-medium">Account</h4>
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

  const dailyActivity = await getUserDailyActivity(id, 14);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <DashboardHeader />

      <div className="mx-auto w-full max-w-7xl px-4 py-8">
        <header className="flex items-center gap-4">
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
              <h2 className="text-2xl font-semibold tracking-tight">
                {user.firstName || user.lastName
                  ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                  : user.email}
                {user.isAdmin && (
                  <span className="ml-2 rounded bg-primary/10 px-2 py-1 text-sm font-medium text-primary">
                    Admin
                  </span>
                )}
              </h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
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
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm">{user.email}</p>
                </div>
              </div>

              {user.username && (
                <div className="flex items-center gap-3">
                  <AtSign className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Username</p>
                    <p className="text-sm">@{user.username}</p>
                  </div>
                </div>
              )}

              {(user.firstName || user.lastName) && (
                <div className="flex items-center gap-3">
                  <User className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="text-sm">
                      {`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Calendar className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Joined</p>
                  <p className="text-sm">
                    {new Date(user.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>

              <hr />

              <div className="flex items-center gap-3">
                <Box className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Items</p>
                  <p className="text-sm font-medium">{user._count.items}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Home className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Rooms</p>
                  <p className="text-sm font-medium">{user._count.rooms}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <HardDrive className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Storage Used</p>
                  <p className="text-sm font-medium">
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
        </div>
      </div>
    </div>
  );
}
