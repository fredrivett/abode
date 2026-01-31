"use client";

import type { RoomVisibility } from "@prisma/client";
import { DoorOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { EmojiPickerPopover } from "@/components/rooms/emoji-picker-popover";
import { FilterBadges } from "@/components/rooms/filter-badges";
import { VisibilityToggle } from "@/components/rooms/visibility-toggle";
import { Button } from "@/components/ui/button";
import {
  DialogOrDrawer,
  DialogOrDrawerContent,
  DialogOrDrawerDescription,
  DialogOrDrawerFooter,
  DialogOrDrawerHeader,
  DialogOrDrawerTitle,
} from "@/components/ui/dialog-or-drawer";
import { Input } from "@/components/ui/input";
import { IsLoading } from "@/components/ui/is-loading";
import type { SearchState } from "@/lib/search";
import { useMilestoneStore } from "@/stores/milestone-store";

type SaveAsRoomButtonProps = {
  searchState: SearchState;
};

export function SaveAsRoomButton({ searchState }: SaveAsRoomButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [emoji, setEmoji] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("");
  const [visibility, setVisibility] = useState<RoomVisibility>("private");
  const [isCreating, setIsCreating] = useState(false);

  // Only show if there are filters (not just a text query)
  if (searchState.filters.length === 0) {
    return null;
  }

  const handleCreate = async () => {
    if (!roomName.trim()) {
      toast.error("Please enter a room name");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/v1/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName.trim(),
          emoji,
          type: "smart",
          filters: searchState.filters,
          visibility,
        }),
      });

      if (response.ok) {
        const room = await response.json();
        // Mark milestones for room creation (always smart room here)
        useMilestoneStore.getState().markComplete("create_first_room");
        useMilestoneStore.getState().markComplete("create_dynamic_room");
        toast.success("Dynamic room created");
        setIsOpen(false);
        router.push(`/@${room.username}/${room.slug}`);
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to create room");
      }
    } catch {
      toast.error("Failed to create room");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-1.5"
      >
        <DoorOpen className="size-4" />
        Save as Room
      </Button>

      <DialogOrDrawer open={isOpen} onOpenChange={setIsOpen}>
        <DialogOrDrawerContent className="sm:max-w-md">
          <DialogOrDrawerHeader>
            <DialogOrDrawerTitle>Save as Dynamic Room</DialogOrDrawerTitle>
            <DialogOrDrawerDescription>
              Create a dynamic room from your current filters. Items matching
              these filters will be automatically added to the room.
            </DialogOrDrawerDescription>
          </DialogOrDrawerHeader>

          <div className="space-y-4 px-4 py-4 md:px-0">
            <div className="space-y-2">
              <label htmlFor="roomName" className="font-medium text-sm">
                Room name
              </label>
              <div className="flex items-center gap-2">
                <EmojiPickerPopover value={emoji} onChange={setEmoji} />
                <Input
                  id="roomName"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="My Collection"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleCreate();
                    }
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <span className="font-medium text-sm">Visibility</span>
              <VisibilityToggle value={visibility} onChange={setVisibility} />
            </div>

            <div className="space-y-2">
              <span className="font-medium text-sm">Filters</span>
              <div className="flex flex-wrap gap-1.5 rounded-md bg-muted/50 p-3">
                <FilterBadges filters={searchState.filters} />
              </div>
            </div>
          </div>

          <DialogOrDrawerFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? (
                <IsLoading label="Creating" />
              ) : (
                "Create Dynamic Room"
              )}
            </Button>
          </DialogOrDrawerFooter>
        </DialogOrDrawerContent>
      </DialogOrDrawer>
    </>
  );
}
