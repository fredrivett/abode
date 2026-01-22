import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import db from "@/lib/db";
import { WaitlistTable } from "../../_components/waitlist-table";

const PAGE_SIZE = 20;

type SearchParams = Promise<{ page?: string }>;

export default async function AdminWaitlistPage(props: {
  searchParams: SearchParams;
}) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, Number.parseInt(searchParams.page || "1", 10));

  // Get total count
  const totalCount = await db.waitlistEntry.count();

  // Get waitlist entries with their invite status
  const entries = await db.waitlistEntry.findMany({
    orderBy: { createdAt: "asc" },
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
    include: {
      invites: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          acceptedAt: true,
          expiresAt: true,
        },
      },
    },
  });

  const formattedEntries = entries.map((entry) => {
    const latestInvite = entry.invites[0];
    let status: "waiting" | "invited" | "joined" = "waiting";

    if (latestInvite) {
      if (latestInvite.acceptedAt) {
        status = "joined";
      } else if (latestInvite.expiresAt > new Date()) {
        status = "invited";
      }
    }

    return {
      id: entry.id,
      email: entry.email,
      position: entry.position,
      referralSource: entry.referralSource,
      createdAt: entry.createdAt.toISOString(),
      status,
    };
  });

  const pagination = {
    page,
    pageSize: PAGE_SIZE,
    totalCount,
    totalPages: Math.ceil(totalCount / PAGE_SIZE),
  };

  // Get stats
  const [waitingCount, invitedCount, joinedCount] = await Promise.all([
    db.waitlistEntry.count({
      where: {
        invites: { none: {} },
      },
    }),
    db.waitlistEntry.count({
      where: {
        invites: {
          some: {
            acceptedAt: null,
            expiresAt: { gt: new Date() },
          },
        },
      },
    }),
    db.waitlistEntry.count({
      where: {
        invites: {
          some: {
            acceptedAt: { not: null },
          },
        },
      },
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
            <h2 className="font-semibold text-2xl tracking-tight">Waitlist</h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Manage waitlist entries and send invites.
            </p>
          </div>
        </header>

        <div className="mt-8 space-y-6">
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">Waiting</p>
              <p className="font-semibold text-2xl">{waitingCount}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">Invited</p>
              <p className="font-semibold text-2xl">{invitedCount}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">Joined</p>
              <p className="font-semibold text-2xl">{joinedCount}</p>
            </div>
          </div>

          <WaitlistTable entries={formattedEntries} pagination={pagination} />
        </div>
      </div>
    </div>
  );
}
