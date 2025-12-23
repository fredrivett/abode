import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Input } from "@/components/ui/input";
import db from "@/lib/db";
import { UsersTable } from "../../_components/users-table";

const PAGE_SIZE = 20;

type SearchParams = Promise<{ page?: string; search?: string }>;

export default async function AdminUsersPage(props: {
  searchParams: SearchParams;
}) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, parseInt(searchParams.page || "1", 10));
  const search = searchParams.search?.trim() || "";

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
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  });

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
            <h2 className="text-2xl font-semibold tracking-tight">Users</h2>
            <p className="mt-1 text-sm text-muted-foreground">
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
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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
