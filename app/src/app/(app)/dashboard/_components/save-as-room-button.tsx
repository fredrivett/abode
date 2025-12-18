"use client";

import { Blocks } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
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
import type { FilterValue, RoomFilters } from "@/lib/rooms";
import type { Filter, SearchState } from "@/lib/search";

type SaveAsRoomButtonProps = {
  searchState: SearchState;
};

/**
 * Convert search filters to room filters format.
 * Note: Date filters are converted to dateAfter/dateBefore.
 */
function searchFiltersToRoomFilters(filters: Filter[]): RoomFilters {
  const roomFilters: RoomFilters = {};

  for (const filter of filters) {
    const filterValue: FilterValue = {
      value: filter.value,
      negated: filter.negated,
    };

    switch (filter.type) {
      case "type":
        roomFilters.type = [...(roomFilters.type || []), filterValue];
        break;
      case "tag":
        roomFilters.tag = [...(roomFilters.tag || []), filterValue];
        break;
      case "object":
        roomFilters.object = [...(roomFilters.object || []), filterValue];
        break;
      case "color":
        roomFilters.color = [...(roomFilters.color || []), filterValue];
        break;
      case "source":
        roomFilters.source = [...(roomFilters.source || []), filterValue];
        break;
      case "location":
        roomFilters.location = [...(roomFilters.location || []), filterValue];
        break;
      case "date":
        // Handle date filters by converting to dateAfter/dateBefore
        if (filter.dateOperator === "after") {
          roomFilters.dateAfter = filter.value;
        } else if (filter.dateOperator === "before") {
          roomFilters.dateBefore = filter.value;
        } else if (filter.dateOperator === "between") {
          roomFilters.dateAfter = filter.value;
          roomFilters.dateBefore = filter.endDate;
        } else {
          // "is" means exact date - use both as same value
          roomFilters.dateAfter = filter.value;
          roomFilters.dateBefore = filter.value;
        }
        break;
    }
  }

  return roomFilters;
}

export function SaveAsRoomButton({ searchState }: SaveAsRoomButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [roomName, setRoomName] = useState("");
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
      const roomFilters = searchFiltersToRoomFilters(searchState.filters);

      const response = await fetch("/api/v1/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName.trim(),
          type: "smart",
          filters: roomFilters,
          visibility: "private",
        }),
      });

      if (response.ok) {
        const room = await response.json();
        toast.success("Smart room created");
        setIsOpen(false);
        router.push(`/rooms/${room.id}`);
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to create room");
        setIsCreating(false);
      }
    } catch {
      toast.error("Failed to create room");
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

            <div className="space-y-2">
              <span className="text-sm font-medium">Filters</span>
              <div className="flex flex-wrap gap-1.5 p-3 rounded-md bg-muted/50">
                {searchState.filters.map((filter) => (
                  <span
                    key={filter.id}
                    className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                  >
                    {filter.negated && "!"}
                    {filter.type}:{filter.value}
                    {filter.endDate && `..${filter.endDate}`}
                  </span>
                ))}
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
