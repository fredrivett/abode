"use client";

import type { RoomVisibility } from "@prisma/client";
import { Blocks } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { EmojiPickerPopover } from "@/components/rooms/emoji-picker-popover";
import { FilterBadges } from "@/components/rooms/filter-badges";
import { VisibilityToggle } from "@/components/rooms/visibility-toggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { IsLoading } from "@/components/ui/is-loading";
import type { SearchState } from "@/lib/search";

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
        toast.success("Smart room created");
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
        <Blocks className="size-4" />
        Save as Room
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save as Smart Room</DialogTitle>
            <DialogDescription>
              Create a smart room from your current filters. Items matching
              these filters will be automatically added to the room.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="roomName" className="text-sm font-medium">
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
              <span className="text-sm font-medium">Visibility</span>
              <VisibilityToggle value={visibility} onChange={setVisibility} />
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium">Filters</span>
              <div className="flex flex-wrap gap-1.5 rounded-md bg-muted/50 p-3">
                <FilterBadges filters={searchState.filters} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? (
                <IsLoading label="Creating" />
              ) : (
                "Create Smart Room"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
