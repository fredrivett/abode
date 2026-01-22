"use client";

import { formatDistanceToNow } from "date-fns";
import { Check, ChevronLeft, ChevronRight, Clock, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type WaitlistEntry = {
  id: string;
  email: string;
  position: number | null;
  referralSource: string | null;
  createdAt: string;
  status: "waiting" | "invited" | "joined";
};

type Pagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

type WaitlistTableProps = {
  entries: WaitlistEntry[];
  pagination: Pagination;
};

export function WaitlistTable({ entries, pagination }: WaitlistTableProps) {
  const { page, totalPages, totalCount } = pagination;
  const [sendingInvites, setSendingInvites] = useState<Set<string>>(new Set());
  const [invitedEntries, setInvitedEntries] = useState<Set<string>>(new Set());

  const buildPageUrl = (newPage: number) => {
    return `/admin/waitlist?page=${newPage}`;
  };

  const handleSendInvite = async (entry: WaitlistEntry) => {
    setSendingInvites((prev) => new Set(prev).add(entry.id));

    try {
      const response = await fetch("/api/v1/admin/waitlist/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waitlistEntryId: entry.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to send invite");
        return;
      }

      toast.success(`Invite sent to ${entry.email}`);
      setInvitedEntries((prev) => new Set(prev).add(entry.id));
    } catch {
      toast.error("Failed to send invite");
    } finally {
      setSendingInvites((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    }
  };

  const getStatusBadge = (entry: WaitlistEntry) => {
    if (invitedEntries.has(entry.id) || entry.status === "invited") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700 text-xs dark:bg-blue-900/30 dark:text-blue-400">
          <Mail className="size-3" />
          Invited
        </span>
      );
    }
    if (entry.status === "joined") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700 text-xs dark:bg-green-900/30 dark:text-green-400">
          <Check className="size-3" />
          Joined
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 font-medium text-xs text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
        <Clock className="size-3" />
        Waiting
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">#</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Signed Up</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-muted-foreground"
              >
                No waitlist entries yet
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-muted-foreground">
                  {entry.position ?? "-"}
                </TableCell>
                <TableCell className="font-medium">{entry.email}</TableCell>
                <TableCell className="text-muted-foreground">
                  {entry.referralSource || "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDistanceToNow(new Date(entry.createdAt), {
                    addSuffix: true,
                  })}
                </TableCell>
                <TableCell>{getStatusBadge(entry)}</TableCell>
                <TableCell className="text-right">
                  {entry.status === "waiting" &&
                    !invitedEntries.has(entry.id) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendInvite(entry)}
                        disabled={sendingInvites.has(entry.id)}
                      >
                        {sendingInvites.has(entry.id) ? (
                          <IsLoading label="Sending" />
                        ) : (
                          "Send Invite"
                        )}
                      </Button>
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
            entries
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
