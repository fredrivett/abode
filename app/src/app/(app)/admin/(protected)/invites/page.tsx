import type { Prisma } from "@prisma/client";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Input } from "@/components/ui/input";
import db from "@/lib/db";
import { InvitesTable } from "../../_components/invites-table";

const PAGE_SIZE = 20;

type SearchParams = Promise<{
  page?: string;
  search?: string;
  status?: string;
  origin?: string;
}>;

export default async function AdminInvitesPage(props: {
  searchParams: SearchParams;
}) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, Number.parseInt(searchParams.page || "1", 10));
  const search = searchParams.search?.trim() || "";
  const statusFilter = searchParams.status || "all";
  const originFilter = searchParams.origin || "all";

  // Build where clause
  const where: Prisma.InviteWhereInput = {};

  if (search) {
    where.email = { contains: search, mode: "insensitive" };
  }

  if (statusFilter === "pending") {
    where.status = "pending";
    where.expiresAt = { gt: new Date() };
  } else if (statusFilter === "accepted") {
    where.status = "accepted";
  } else if (statusFilter === "expired") {
    where.status = "pending";
    where.expiresAt = { lte: new Date() };
  }

  if (originFilter === "user") {
    where.origin = "user";
  } else if (originFilter === "waitlist") {
    where.origin = "waitlist";
  } else if (originFilter === "admin") {
    where.origin = "admin";
  }

  // Get total count
  const totalCount = await db.invite.count({ where });

  // Get invites with related data
  const invites = await db.invite.findMany({
    where,
    select: {
      id: true,
      email: true,
      origin: true,
      status: true,
      expiresAt: true,
      acceptedAt: true,
      sendCount: true,
      createdAt: true,
      inviter: {
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
      waitlistEntry: {
        select: {
          id: true,
          referralSource: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  });

  const now = new Date();
  const formattedInvites = invites.map((invite) => {
    let displayStatus: "pending" | "accepted" | "expired" = "pending";
    if (invite.status === "accepted") {
      displayStatus = "accepted";
    } else if (invite.expiresAt <= now) {
      displayStatus = "expired";
    }

    return {
      id: invite.id,
      email: invite.email,
      origin: invite.origin,
      status: displayStatus,
      expiresAt: invite.expiresAt.toISOString(),
      acceptedAt: invite.acceptedAt?.toISOString() || null,
      sendCount: invite.sendCount,
      createdAt: invite.createdAt.toISOString(),
      inviter: invite.inviter
        ? {
            id: invite.inviter.id,
            email: invite.inviter.email,
            username: invite.inviter.username,
            displayName:
              invite.inviter.firstName && invite.inviter.lastName
                ? `${invite.inviter.firstName} ${invite.inviter.lastName}`
                : invite.inviter.username || invite.inviter.email,
          }
        : null,
      waitlistEntryId: invite.waitlistEntry?.id || null,
      referralSource: invite.waitlistEntry?.referralSource || null,
    };
  });

  const pagination = {
    page,
    pageSize: PAGE_SIZE,
    totalCount,
    totalPages: Math.ceil(totalCount / PAGE_SIZE),
  };

  // Get stats
  const [
    pendingCount,
    acceptedCount,
    expiredCount,
    userOriginCount,
    waitlistOriginCount,
    adminOriginCount,
  ] = await Promise.all([
    db.invite.count({
      where: { status: "pending", expiresAt: { gt: new Date() } },
    }),
    db.invite.count({
      where: { status: "accepted" },
    }),
    db.invite.count({
      where: { status: "pending", expiresAt: { lte: new Date() } },
    }),
    db.invite.count({
      where: { origin: "user" },
    }),
    db.invite.count({
      where: { origin: "waitlist" },
    }),
    db.invite.count({
      where: { origin: "admin" },
    }),
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
            <h2 className="text-2xl font-semibold tracking-tight">Invites</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              View and manage all invites across the platform.
            </p>
          </div>
        </header>

        <div className="mt-8 space-y-6">
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-semibold">{pendingCount}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Accepted</p>
              <p className="text-2xl font-semibold">{acceptedCount}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Expired</p>
              <p className="text-2xl font-semibold">{expiredCount}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">From Users</p>
              <p className="text-2xl font-semibold">{userOriginCount}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">From Waitlist</p>
              <p className="text-2xl font-semibold">{waitlistOriginCount}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">From Admin</p>
              <p className="text-2xl font-semibold">{adminOriginCount}</p>
            </div>
          </div>

          {/* Search and filters */}
          <div className="flex flex-wrap items-center gap-4">
            <form
              action="/admin/invites"
              method="GET"
              className="relative max-w-sm flex-1"
            >
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                name="search"
                placeholder="Search by email..."
                defaultValue={search}
                className="pl-9"
              />
              {statusFilter !== "all" && (
                <input type="hidden" name="status" value={statusFilter} />
              )}
              {originFilter !== "all" && (
                <input type="hidden" name="origin" value={originFilter} />
              )}
            </form>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <div className="flex rounded-md border">
                <Link
                  href={`/admin/invites?${new URLSearchParams({ search, origin: originFilter }).toString()}`}
                  className={`px-3 py-1.5 text-sm ${statusFilter === "all" ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                >
                  All
                </Link>
                <Link
                  href={`/admin/invites?${new URLSearchParams({ search, status: "pending", origin: originFilter }).toString()}`}
                  className={`border-l px-3 py-1.5 text-sm ${statusFilter === "pending" ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                >
                  Pending
                </Link>
                <Link
                  href={`/admin/invites?${new URLSearchParams({ search, status: "accepted", origin: originFilter }).toString()}`}
                  className={`border-l px-3 py-1.5 text-sm ${statusFilter === "accepted" ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                >
                  Accepted
                </Link>
                <Link
                  href={`/admin/invites?${new URLSearchParams({ search, status: "expired", origin: originFilter }).toString()}`}
                  className={`border-l px-3 py-1.5 text-sm ${statusFilter === "expired" ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                >
                  Expired
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Origin:</span>
              <div className="flex rounded-md border">
                <Link
                  href={`/admin/invites?${new URLSearchParams({ search, status: statusFilter === "all" ? "" : statusFilter }).toString()}`}
                  className={`px-3 py-1.5 text-sm ${originFilter === "all" ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                >
                  All
                </Link>
                <Link
                  href={`/admin/invites?${new URLSearchParams({ search, status: statusFilter === "all" ? "" : statusFilter, origin: "user" }).toString()}`}
                  className={`border-l px-3 py-1.5 text-sm ${originFilter === "user" ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                >
                  User
                </Link>
                <Link
                  href={`/admin/invites?${new URLSearchParams({ search, status: statusFilter === "all" ? "" : statusFilter, origin: "waitlist" }).toString()}`}
                  className={`border-l px-3 py-1.5 text-sm ${originFilter === "waitlist" ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                >
                  Waitlist
                </Link>
                <Link
                  href={`/admin/invites?${new URLSearchParams({ search, status: statusFilter === "all" ? "" : statusFilter, origin: "admin" }).toString()}`}
                  className={`border-l px-3 py-1.5 text-sm ${originFilter === "admin" ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                >
                  Admin
                </Link>
              </div>
            </div>
          </div>

          <InvitesTable
            invites={formattedInvites}
            pagination={pagination}
            search={search}
            statusFilter={statusFilter}
            originFilter={originFilter}
          />
        </div>
      </div>
    </div>
  );
}
