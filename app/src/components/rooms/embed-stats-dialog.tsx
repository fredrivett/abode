"use client";

import type { RoomVisibility } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ExternalLink, Globe } from "lucide-react";
import { DateTime } from "@/components/ui/date-time";
import {
  DialogOrDrawer,
  DialogOrDrawerBody,
  DialogOrDrawerContent,
  DialogOrDrawerDescription,
  DialogOrDrawerHeader,
  DialogOrDrawerTitle,
} from "@/components/ui/dialog-or-drawer";
import { IsLoading } from "@/components/ui/is-loading";
import { api } from "@/lib/api-client";

type Referrer = {
  url: string;
  domain: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  viewCount: number;
};

type ReferrersResponse = {
  referrers: Referrer[];
};

type EmbedStatsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  roomName: string;
  visibility: RoomVisibility;
};

function useRoomReferrers(roomId: string, enabled: boolean) {
  return useQuery<ReferrersResponse>({
    queryKey: ["rooms", roomId, "referrers"],
    queryFn: () => api.get(`/api/v1/rooms/${roomId}/referrers`),
    enabled,
  });
}

export function EmbedStatsDialog({
  open,
  onOpenChange,
  roomId,
  roomName,
  visibility,
}: EmbedStatsDialogProps) {
  const isPublic = visibility === "public";
  const { data, isLoading, error } = useRoomReferrers(roomId, open && isPublic);

  const referrers = data?.referrers ?? [];
  const totalViews = referrers.reduce((sum, r) => sum + r.viewCount, 0);

  return (
    <DialogOrDrawer open={open} onOpenChange={onOpenChange}>
      <DialogOrDrawerContent className="sm:max-w-lg">
        <DialogOrDrawerHeader>
          <DialogOrDrawerTitle>Embed stats</DialogOrDrawerTitle>
          <DialogOrDrawerDescription>
            See where {roomName} is being embedded across the web.
          </DialogOrDrawerDescription>
        </DialogOrDrawerHeader>

        <DialogOrDrawerBody className="space-y-4">
          {!isPublic ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p>
                This room is private. Make it public to enable embedding and
                track where your room is being used.
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <IsLoading label="Loading stats" />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {error.message}
            </div>
          ) : referrers.length === 0 ? (
            <div className="py-8 text-center">
              <Globe className="mx-auto mb-3 size-10 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm">
                No embeds tracked yet. Share your room&apos;s embed code to see
                where it&apos;s being used.
              </p>
            </div>
          ) : (
            <>
              <div className="text-muted-foreground text-sm">
                {referrers.length} {referrers.length === 1 ? "site" : "sites"} ·{" "}
                {totalViews} total {totalViews === 1 ? "view" : "views"}
                {referrers.length === 50 && " · Showing top 50 referrers"}
              </div>

              <div className="divide-y rounded-lg border">
                {referrers.map((referrer) => (
                  <div
                    key={referrer.url}
                    className="flex items-start justify-between gap-4 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <a
                        href={referrer.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-1.5 font-medium hover:underline"
                      >
                        <span className="truncate">
                          {referrer.domain ?? referrer.url}
                        </span>
                        <ExternalLink className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                      </a>
                      <p className="truncate text-muted-foreground text-xs">
                        {referrer.url}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <div className="text-muted-foreground">
                        {referrer.viewCount}{" "}
                        {referrer.viewCount === 1 ? "view" : "views"}
                      </div>
                      <div className="text-muted-foreground/70 text-xs">
                        <DateTime date={referrer.lastSeenAt} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogOrDrawerBody>
      </DialogOrDrawerContent>
    </DialogOrDrawer>
  );
}
