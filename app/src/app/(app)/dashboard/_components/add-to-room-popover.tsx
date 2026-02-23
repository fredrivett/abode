"use client";

import { Check, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import posthog from "posthog-js";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { IsLoading } from "@/components/ui/is-loading";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/lib/api-client";
import type { ItemRoom } from "@/lib/types/item";
import { cn } from "@/lib/utils";

type Room = {
  id: string;
  name: string;
  emoji: string | null;
  itemCount: number;
};

type AddToRoomPopoverProps = {
  itemId: string;
  currentRooms: ItemRoom[];
  onRoomsChange: (rooms: ItemRoom[]) => void;
};

/**
 * Popover for adding or removing an item from manual rooms.
 *
 * Lazily fetches the user's manual rooms on first open and toggles membership
 * for each room via API calls.
 */
export function AddToRoomPopover({
  itemId,
  currentRooms,
  onRoomsChange,
}: AddToRoomPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [manualRooms, setManualRooms] = useState<Room[]>([]);
  const [togglingRoomId, setTogglingRoomId] = useState<string | null>(null);

  const [hasFetched, setHasFetched] = useState(false);

  // Fetch static rooms when popover opens (only once)
  useEffect(() => {
    if (!isOpen || hasFetched) return;

    const abortController = new AbortController();

    const fetchRooms = async () => {
      setIsLoading(true);
      try {
        const rooms = await api.get<Room[]>("/api/v1/rooms?type=manual", {
          signal: abortController.signal,
        });
        setManualRooms(rooms);
        setHasFetched(true);
      } catch (error) {
        // Don't show error toast if request was aborted
        if (error instanceof Error && error.name === "AbortError") return;
        toast.error("Failed to load rooms");
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void fetchRooms();

    return () => abortController.abort();
  }, [isOpen, hasFetched]);

  const isItemInRoom = useCallback(
    (roomId: string) => currentRooms.some((r) => r.id === roomId),
    [currentRooms],
  );

  const handleToggleRoom = async (room: Room) => {
    const isInRoom = isItemInRoom(room.id);
    setTogglingRoomId(room.id);

    try {
      if (isInRoom) {
        // Remove from room
        await api.delete(`/api/v1/rooms/${room.id}/items`, {
          body: JSON.stringify({ itemId }),
        });
        onRoomsChange(currentRooms.filter((r) => r.id !== room.id));
        toast.success(`Removed from ${room.name}`);
      } else {
        // Add to room
        const response = await api.post<{ room: ItemRoom }>(
          `/api/v1/rooms/${room.id}/items`,
          { itemId },
        );
        onRoomsChange([...currentRooms, response.room]);

        // Track item added to room event
        posthog.capture("item_added_to_room", {
          item_id: itemId,
          room_id: room.id,
          room_name: room.name,
        });

        toast.success(`Added to ${room.name}`);
      }
    } catch (error) {
      posthog.captureException(error);
      toast.error(
        isInRoom ? "Failed to remove from room" : "Failed to add to room",
      );
    } finally {
      setTogglingRoomId(null);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
        >
          <Plus className="size-3.5" />
          Add to room
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <IsLoading label="Loading rooms" />
          </div>
        ) : manualRooms.length === 0 ? (
          <div className="py-4 text-center">
            <p className="mb-2 text-muted-foreground text-sm">
              No static rooms yet
            </p>
            <Link
              href="/rooms/new"
              className="text-primary text-sm hover:underline"
            >
              Create a room
            </Link>
          </div>
        ) : (
          <div className="space-y-1">
            {manualRooms.map((room) => {
              const inRoom = isItemInRoom(room.id);
              const isToggling = togglingRoomId === room.id;

              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => handleToggleRoom(room)}
                  disabled={isToggling}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    inRoom
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted",
                    isToggling && "opacity-50",
                  )}
                >
                  <span className="flex size-4 items-center justify-center">
                    {isToggling ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : inRoom ? (
                      <Check className="size-3.5" />
                    ) : null}
                  </span>
                  {room.emoji && <span className="text-sm">{room.emoji}</span>}
                  <span className="flex-1 truncate text-left">{room.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
