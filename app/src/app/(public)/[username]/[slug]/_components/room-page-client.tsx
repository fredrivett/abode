"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { DashboardHeaderClient } from "@/components/layout/dashboard-header/client";
import { FilterBadges } from "@/components/rooms/filter-badges";
import { RoomHeaderFilters } from "@/components/rooms/room-header-filters";
import type { Filter } from "@/lib/search/types";
import type { Room, RoomItem } from "@/lib/types/room";
import { RoomDetail } from "./room-detail";

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
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);

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

      setFilters(newFilters);
    },
    [room.id],
  );

  const handleFiltersChanged = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/rooms/${room.id}/items`);
      if (response.ok) {
        const data = await response.json();
        setItems(data.items);
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } else {
        toast.error("Failed to refresh items");
      }
    } catch {
      toast.error("Failed to refresh items");
    }
  }, [room.id]);

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
          onFiltersChanged={handleFiltersChanged}
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
      {isAuthenticated && signOutAction ? (
        <DashboardHeaderClient
          isAuthenticated
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
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <RoomDetail
          room={{ ...room, filters }}
          initialItems={items}
          initialCursor={cursor}
          initialHasMore={hasMore}
          isOwner={isOwner}
          roomOwner={roomOwner}
        />
      </div>
    </>
  );
}
