import type { Prisma } from "@prisma/client";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Input } from "@/components/ui/input";
import db from "@/lib/db";
import { parseSortParams, type SortState } from "@/lib/table-sort";
import {
  USER_SORT_COLUMNS,
  type UserSortColumn,
} from "../../_components/users-sort";
import { UsersTable } from "../../_components/users-table";

const PAGE_SIZE = 20;

export const metadata = {
  title: "Users | Admin | abode",
};

function buildUserOrderBy(
  sort: SortState<UserSortColumn>,
): Prisma.UserOrderByWithRelationInput {
  const direction = sort.direction;
  switch (sort.column) {
    case "user":
      return { firstName: { sort: direction, nulls: "last" } };
    case "username":
      return { username: { sort: direction, nulls: "last" } };
    case "items":
      return { items: { _count: direction } };
    case "rooms":
      return { rooms: { _count: direction } };
    case "storage":
      return { storageUsedBytes: direction };
    case "joined":
      return { createdAt: direction };
    case null:
      return { createdAt: "desc" };
    default: {
      // Exhaustiveness guard: a new USER_SORT_COLUMNS entry without a case here
      // is a compile error, keeping the allowlist and this mapping in sync.
      const _exhaustive: never = sort.column;
      return _exhaustive;
    }
  }
}

type SearchParams = Promise<{
  page?: string;
  search?: string;
  sort?: string;
  dir?: string;
}>;

export default async function AdminUsersPage(props: {
  searchParams: SearchParams;
}) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, parseInt(searchParams.page || "1", 10));
  const search = searchParams.search?.trim() || "";
  const sort = parseSortParams(
    { sort: searchParams.sort, dir: searchParams.dir },
    USER_SORT_COLUMNS,
  );

  // Build where clause
  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { username: { contains: search, mode: "insensitive" as const } },
          { firstName: { contains: search, mode: "insensitive" as const } },
          { lastName: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  // Get total count
  const totalCount = await db.user.count({ where });

  // Get users
  const users = await db.user.findMany({
    where,
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
      _count: {
        select: {
          items: true,
          rooms: true,
        },
      },
    },
    orderBy: buildUserOrderBy(sort),
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  });

  const userIds = users.map((user) => user.id);

  // Last activity (any tracked action) and last item added, per user on this page
  const [lastActivity, lastItems] = await Promise.all([
    db.activityLog.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds } },
      _max: { createdAt: true },
    }),
    db.item.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds } },
      _max: { createdAt: true },
    }),
  ]);

  const lastActiveByUser = new Map(
    lastActivity.map((row) => [row.userId, row._max.createdAt]),
  );
  const lastItemByUser = new Map(
    lastItems.map((row) => [row.userId, row._max.createdAt]),
  );

  const formattedUsers = users.map((user) => ({
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    isAdmin: user.isAdmin,
    storageUsedBytes: user.storageUsedBytes.toString(),
    itemCount: user._count.items,
    roomCount: user._count.rooms,
    createdAt: user.createdAt.toISOString(),
    lastActiveAt: lastActiveByUser.get(user.id)?.toISOString() ?? null,
    lastItemAddedAt: lastItemByUser.get(user.id)?.toISOString() ?? null,
  }));

  const pagination = {
    page,
    pageSize: PAGE_SIZE,
    totalCount,
    totalPages: Math.ceil(totalCount / PAGE_SIZE),
  };

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
            <h2 className="font-semibold text-2xl tracking-tight">Users</h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Manage and view user accounts.
            </p>
          </div>
        </header>

        <div className="mt-8 space-y-6">
          {/* Search form */}
          <form
            action="/admin/users"
            method="GET"
            className="relative max-w-sm"
          >
            <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
            <Input
              type="search"
              name="search"
              placeholder="Search by email, username, or name..."
              defaultValue={search}
              className="pl-9"
            />
          </form>

          <UsersTable
            users={formattedUsers}
            pagination={pagination}
            search={search}
          />
        </div>
      </div>
    </div>
  );
}
