"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Mail,
  User,
  Users,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Invite = {
  id: string;
  email: string;
  origin: "user" | "waitlist" | "admin";
  status: "pending" | "accepted" | "expired";
  expiresAt: string;
  acceptedAt: string | null;
  sendCount: number;
  createdAt: string;
  inviter: {
    id: string;
    email: string;
    username: string | null;
    displayName: string;
  } | null;
  waitlistEntryId: string | null;
  referralSource: string | null;
};

type Pagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

type InvitesTableProps = {
  invites: Invite[];
  pagination: Pagination;
  search: string;
  statusFilter: string;
  originFilter: string;
};

export function InvitesTable({
  invites,
  pagination,
  search,
  statusFilter,
  originFilter,
}: InvitesTableProps) {
  const { page, totalPages, totalCount } = pagination;

  const buildPageUrl = (newPage: number) => {
    const params = new URLSearchParams();
    params.set("page", String(newPage));
    if (search) params.set("search", search);
    if (statusFilter && statusFilter !== "all")
      params.set("status", statusFilter);
    if (originFilter && originFilter !== "all")
      params.set("origin", originFilter);
    return `/admin/invites?${params.toString()}`;
  };

  const getStatusBadge = (invite: Invite) => {
    if (invite.status === "accepted") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <Check className="size-3" />
          Accepted
        </span>
      );
    }
    if (invite.status === "expired") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
          <XCircle className="size-3" />
          Expired
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
        <Clock className="size-3" />
        Pending
      </span>
    );
  };

  const getOriginBadge = (invite: Invite) => {
    if (invite.origin === "user") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
          <User className="size-3" />
          User
        </span>
      );
    }
    if (invite.origin === "waitlist") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
          <Users className="size-3" />
          Waitlist
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
        <Mail className="size-3" />
        Admin
      </span>
    );
  };

  const getInviterInfo = (invite: Invite) => {
    if (invite.origin === "user" && invite.inviter) {
      return (
        <Link
          href={`/admin/users/${invite.inviter.id}`}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          {invite.inviter.displayName}
        </Link>
      );
    }
    if (invite.origin === "waitlist" && invite.waitlistEntryId) {
      return (
        <span className="text-sm text-muted-foreground">
          {invite.referralSource || "Direct"}
        </span>
      );
    }
    return <span className="text-sm text-muted-foreground">-</span>;
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Origin</TableHead>
            <TableHead>From</TableHead>
            <TableHead>Sent</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Expires/Accepted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invites.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-muted-foreground"
              >
                No invites found
              </TableCell>
            </TableRow>
          ) : (
            invites.map((invite) => (
              <TableRow key={invite.id}>
                <TableCell className="font-medium">{invite.email}</TableCell>
                <TableCell>{getStatusBadge(invite)}</TableCell>
                <TableCell>{getOriginBadge(invite)}</TableCell>
                <TableCell>{getInviterInfo(invite)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {invite.sendCount > 1 ? `${invite.sendCount}x` : "1x"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDistanceToNow(new Date(invite.createdAt), {
                    addSuffix: true,
                  })}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {invite.status === "accepted" && invite.acceptedAt
                    ? formatDistanceToNow(new Date(invite.acceptedAt), {
                        addSuffix: true,
                      })
                    : formatDistanceToNow(new Date(invite.expiresAt), {
                        addSuffix: true,
                      })}
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
            invites
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
