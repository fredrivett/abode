"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DateTime } from "@/components/ui/date-time";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBytes, getUserInitials } from "@/lib/utils";
import type { UserSortColumn } from "./users-sort";

// Typed wrapper so headers only accept columns the server can actually sort by,
// keeping the generic SortableTableHead reusable for other tables.
function UserSortHead({
  column,
  ...props
}: { column: UserSortColumn } & Omit<
  ComponentProps<typeof SortableTableHead>,
  "column"
>) {
  return <SortableTableHead column={column} {...props} />;
}

type User = {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  storageUsedBytes: string;
  itemCount: number;
  roomCount: number;
  createdAt: string;
  lastActiveAt: string | null;
  lastItemAddedAt: string | null;
};

type Pagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

type UsersTableProps = {
  users: User[];
  pagination: Pagination;
  search: string;
};

export function UsersTable({ users, pagination, search }: UsersTableProps) {
  const { page, totalPages, totalCount } = pagination;

  const buildPageUrl = (newPage: number) => {
    const params = new URLSearchParams();
    params.set("page", newPage.toString());
    if (search) params.set("search", search);
    return `/admin/users?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <UserSortHead column="user">User</UserSortHead>
            <UserSortHead column="username">Username</UserSortHead>
            <UserSortHead column="items" align="right" className="text-right">
              Items
            </UserSortHead>
            <UserSortHead column="rooms" align="right" className="text-right">
              Rooms
            </UserSortHead>
            <UserSortHead column="storage" align="right" className="text-right">
              Storage
            </UserSortHead>
            <UserSortHead column="joined">Joined</UserSortHead>
            <TableHead>Last active</TableHead>
            <TableHead>Last item added</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="text-center text-muted-foreground"
              >
                No users found
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="flex items-center gap-3"
                  >
                    <Avatar className="size-8">
                      <AvatarImage src={user.avatarUrl ?? undefined} />
                      <AvatarFallback>
                        {getUserInitials(
                          user.firstName,
                          user.lastName,
                          user.email,
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {user.firstName || user.lastName
                          ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                          : user.email}
                        {user.isAdmin && (
                          <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {user.email}
                      </div>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.username ? (
                    <Link
                      href={`/@${user.username}`}
                      className="hover:text-foreground hover:underline"
                    >
                      @{user.username}
                    </Link>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-right">{user.itemCount}</TableCell>
                <TableCell className="text-right">{user.roomCount}</TableCell>
                <TableCell className="text-right">
                  {formatBytes(BigInt(user.storageUsedBytes))}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <DateTime date={user.createdAt} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.lastActiveAt ? (
                    <DateTime date={user.lastActiveAt} />
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.lastItemAddedAt ? (
                    <DateTime date={user.lastItemAddedAt} />
                  ) : (
                    "-"
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Showing {(page - 1) * pagination.pageSize + 1} to{" "}
            {Math.min(page * pagination.pageSize, totalCount)} of {totalCount}{" "}
            users
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              asChild={page > 1}
            >
              {page > 1 ? (
                <Link href={buildPageUrl(page - 1)}>
                  <ChevronLeft className="size-4" />
                  Previous
                </Link>
              ) : (
                <>
                  <ChevronLeft className="size-4" />
                  Previous
                </>
              )}
            </Button>
            <span className="text-muted-foreground text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              asChild={page < totalPages}
            >
              {page < totalPages ? (
                <Link href={buildPageUrl(page + 1)}>
                  Next
                  <ChevronRight className="size-4" />
                </Link>
              ) : (
                <>
                  Next
                  <ChevronRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
