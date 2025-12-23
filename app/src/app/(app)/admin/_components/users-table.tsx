"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

function formatBytes(bytes: bigint): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = Number(bytes);
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getInitials(
  firstName: string | null,
  lastName: string | null,
  email: string,
): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

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
            <TableHead>User</TableHead>
            <TableHead>Username</TableHead>
            <TableHead className="text-right">Items</TableHead>
            <TableHead className="text-right">Rooms</TableHead>
            <TableHead className="text-right">Storage</TableHead>
            <TableHead>Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
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
                    className="flex items-center gap-3 hover:underline"
                  >
                    <Avatar className="size-8">
                      <AvatarImage src={user.avatarUrl ?? undefined} />
                      <AvatarFallback>
                        {getInitials(user.firstName, user.lastName, user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {user.firstName || user.lastName
                          ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                          : user.email}
                        {user.isAdmin && (
                          <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {user.email}
                      </div>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.username ? `@${user.username}` : "-"}
                </TableCell>
                <TableCell className="text-right">{user.itemCount}</TableCell>
                <TableCell className="text-right">{user.roomCount}</TableCell>
                <TableCell className="text-right">
                  {formatBytes(BigInt(user.storageUsedBytes))}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
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
            <span className="text-sm text-muted-foreground">
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
