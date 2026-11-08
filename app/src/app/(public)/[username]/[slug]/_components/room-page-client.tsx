"use client";

import posthog from "posthog-js";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DashboardHeaderClient } from "@/components/layout/dashboard-header/client";
import { FilterBadges } from "@/components/rooms/filter-badges";
import { RoomHeaderFilters } from "@/components/rooms/room-header-filters";
import type { Filter } from "@/lib/search/types";
import type { Room, RoomItem } from "@/lib/types/room";
import { RoomDetail, type RoomItemsPage } from "./room-detail";

// How often to check on a filter re-sync, and how many straight failed checks
// before giving up so the toast doesn't spin forever
const SYNC_POLL_INTERVAL_MS = 1500;
const MAX_CONSECUTIVE_POLL_FAILURES = 5;

type RoomOwner = {
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

type RoomPageClientProps = {
  room: Room;
  initialItems: RoomItem[];
  initialCursor: string | null;
  initialHasMore: boolean;
  isOwner: boolean;
  // User data for header
  isAuthenticated: boolean;
  userId?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  availableInvites: number;
  signOutAction?: () => Promise<void>;
  // Room owner data
  roomOwner: RoomOwner;
};

export function RoomPageClient({
  room,
  initialItems,
  initialCursor,
  initialHasMore,
  isOwner,
  isAuthenticated,
  userId,
  email,
  firstName,
  lastName,
  username,
  avatarUrl,
  availableInvites,
  signOutAction,
  roomOwner,
}: RoomPageClientProps) {
  const [filters, setFilters] = useState<Filter[] | null>(room.filters);
  // The pending membership re-sync after a filter save, and the page fetched
  // once it finishes
  const [syncRunId, setSyncRunId] = useState<string | null>(null);
  const [refreshed, setRefreshed] = useState<RoomItemsPage | null>(null);

  // Track public room view (only once on mount)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally tracking only on initial page load
  useEffect(() => {
    posthog.capture("public_room_viewed", {
      room_id: room.id,
      room_type: room.type,
      room_owner_username: roomOwner.username,
      is_owner: isOwner,
      is_authenticated: isAuthenticated,
      item_count: room.itemCount,
    });
  }, []);

  const handleSaveFilters = useCallback(
    async (newFilters: Filter[]) => {
      const response = await fetch(`/api/v1/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters: newFilters }),
      });

      if (!response.ok) {
        throw new Error("Failed to save filters");
      }

      const data: { syncRunId?: string } = await response.json();
      setFilters(newFilters);
      setSyncRunId(data.syncRunId ?? null);
    },
    [room.id],
  );

  // Membership re-syncs in the background after a filter save; poll the run,
  // then load the room's new first page once it has finished
  useEffect(() => {
    if (!syncRunId) return;
    let cancelled = false;
    let settled = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const toastId = toast.loading("Updating room");

    const settle = (notify: () => void) => {
      settled = true;
      notify();
      setSyncRunId(null);
    };

    const poll = async () => {
      try {
        const statusRes = await fetch(
          `/api/v1/rooms/${room.id}/sync/${syncRunId}`,
        );
        if (!statusRes.ok) throw new Error("Sync status unavailable");
        const sync: { status: string; itemCount?: number } =
          await statusRes.json();
        if (cancelled) return;

        if (sync.status === "failed") {
          settle(() => toast.error("Failed to update room", { id: toastId }));
          return;
        }
        if (sync.status !== "completed") {
          failures = 0;
          timer = setTimeout(poll, SYNC_POLL_INTERVAL_MS);
          return;
        }

        const itemsRes = await fetch(`/api/v1/rooms/${room.id}/items`);
        if (!itemsRes.ok) throw new Error("Room items unavailable");
        const page = await itemsRes.json();
        if (cancelled) return;
        setRefreshed({
          items: page.items,
          cursor: page.nextCursor,
          hasMore: page.hasMore,
          itemCount: sync.itemCount ?? page.items.length,
        });
        settle(() => toast.success("Room updated", { id: toastId }));
      } catch {
        if (cancelled) return;
        failures += 1;
        if (failures >= MAX_CONSECUTIVE_POLL_FAILURES) {
          settle(() => toast.error("Failed to refresh items", { id: toastId }));
          return;
        }
        timer = setTimeout(poll, SYNC_POLL_INTERVAL_MS);
      }
    };

    timer = setTimeout(poll, SYNC_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      // Superseded by a newer save, or the page went away: drop the spinner
      if (!settled) toast.dismiss(toastId);
    };
  }, [syncRunId, room.id]);

  // Build the center slot for the header
  const renderCenterSlot = () => {
    if (room.type !== "smart" || !filters) {
      return undefined;
    }

    if (isOwner) {
      return (
        <RoomHeaderFilters
          filters={filters}
          onSave={handleSaveFilters}
          canEdit
        />
      );
    }

    return (
      <div className="flex flex-wrap gap-1.5 py-1">
        <FilterBadges filters={filters} />
      </div>
    );
  };

  return (
    <>
      {isAuthenticated && userId && signOutAction ? (
        <DashboardHeaderClient
          isAuthenticated
          userId={userId}
          email={email}
          firstName={firstName}
          lastName={lastName}
          username={username}
          avatarUrl={avatarUrl}
          availableInvites={availableInvites}
          signOutAction={signOutAction}
          showHomeLink
          centerSlot={renderCenterSlot()}
        />
      ) : (
        <DashboardHeaderClient
          isAuthenticated={false}
          showHomeLink
          centerSlot={renderCenterSlot()}
        />
      )}
      <div className="w-full px-4 py-8">
        <RoomDetail
          room={{ ...room, filters }}
          initialItems={initialItems}
          initialCursor={initialCursor}
          initialHasMore={initialHasMore}
          refreshed={refreshed}
          isOwner={isOwner}
          roomOwner={roomOwner}
        />
      </div>
    </>
  );
}
