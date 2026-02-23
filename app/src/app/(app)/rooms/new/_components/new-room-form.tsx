"use client";

import { ArrowLeft, Hand, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EmojiPickerPopover } from "@/components/rooms/emoji-picker-popover";
import { SearchInput } from "@/components/search/search-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IsLoading } from "@/components/ui/is-loading";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { shouldCompleteCreateDynamicRoom } from "@/lib/milestones/conditions";
import type { SearchState } from "@/lib/search/types";
import { useFilterOptions } from "@/lib/search/use-filter-options";
import { cn } from "@/lib/utils";
import { useMilestoneStore } from "@/stores/milestone-store";

const ROOM_EXAMPLES = [
  { emoji: null, name: "My Collection" },
  { emoji: "🇨🇦", name: "Vancouver pics 2025" },
  { emoji: "📚", name: "5 star reads" },
  { emoji: "🎨", name: "Design inspiration" },
  { emoji: "🏠", name: "Home renovation ideas" },
] as const;

const CYCLE_INTERVAL = 6000; // Time between cycles (ms)
const FADE_DURATION = 300; // Fade transition duration (ms)

/**
 * Form for creating a new room with animated placeholder cycling, AI emoji suggestions,
 * and room type selection (static or dynamic with filters).
 */
export function NewRoomForm() {
  const router = useRouter();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [emoji, setEmoji] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [roomType, setRoomType] = useState<"smart" | "manual">("manual");
  const [searchState, setSearchState] = useState<SearchState>({
    query: "",
    filters: [],
  });
  const [isCreating, setIsCreating] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [hasManuallySelectedEmoji, setHasManuallySelectedEmoji] =
    useState(false);
  const hasManuallySelectedEmojiRef = useRef(hasManuallySelectedEmoji);
  hasManuallySelectedEmojiRef.current = hasManuallySelectedEmoji;
  const [isWaitingForEmoji, setIsWaitingForEmoji] = useState(false);

  // Reset to default placeholder when user interacts
  const handleInteraction = useCallback(() => {
    if (!hasInteracted) {
      setHasInteracted(true);
      setPlaceholderIndex(0);
      setIsTransitioning(false);
    }
  }, [hasInteracted]);

  // Handle emoji change - reset on interaction, track when cleared
  const handleEmojiChange = useCallback(
    (newEmoji: string | null, isManual = true) => {
      handleInteraction();
      setEmoji(newEmoji);

      // Track if user manually selected an emoji
      if (isManual) {
        setHasManuallySelectedEmoji(newEmoji !== null);
      }

      // If emoji is cleared and name is empty, allow cycling again
      if (newEmoji === null && !name) {
        setHasInteracted(false);
      }
    },
    [handleInteraction, name],
  );

  // Handle name change - reset on interaction, track when cleared
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newName = e.target.value;
      handleInteraction();
      setName(newName);

      // If name is cleared, clear auto-suggested emoji and allow cycling again
      if (newName === "") {
        if (!hasManuallySelectedEmoji) {
          setEmoji(null);
        }
        if (!emoji || !hasManuallySelectedEmoji) {
          setHasInteracted(false);
        }
      }
    },
    [handleInteraction, emoji, hasManuallySelectedEmoji],
  );

  // Cycle through placeholder examples with fade transition
  useEffect(() => {
    // Only cycle if user hasn't interacted
    if (hasInteracted) return;

    const interval = setInterval(() => {
      // Start fade out
      setIsTransitioning(true);

      // After fade out completes, change the content and fade back in
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % ROOM_EXAMPLES.length);
        setIsTransitioning(false);
      }, FADE_DURATION);
    }, CYCLE_INTERVAL);

    return () => clearInterval(interval);
  }, [hasInteracted]);

  const currentExample = ROOM_EXAMPLES[placeholderIndex];

  // Auto-suggest emoji based on room name (debounced)
  useEffect(() => {
    // Don't suggest if user manually selected an emoji or name is empty
    if (hasManuallySelectedEmoji || !name.trim()) {
      setIsWaitingForEmoji(false);
      return;
    }

    // Start pulsing immediately when name changes
    setIsWaitingForEmoji(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch("/api/v1/ai/suggest-emoji", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
          signal: controller.signal,
        });

        if (response.ok) {
          const data = await response.json();
          // Use ref to get current value, avoiding stale closure
          if (data.emoji && !hasManuallySelectedEmojiRef.current) {
            handleEmojiChange(data.emoji, false);
          }
        }
      } catch {
        // Fail silently - emoji suggestion is non-critical
      } finally {
        setIsWaitingForEmoji(false);
      }
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
      setIsWaitingForEmoji(false);
    };
  }, [name, hasManuallySelectedEmoji, handleEmojiChange]);

  // Get filter options for autocomplete
  const { getFilterValuesForType } = useFilterOptions();

  // Check if we have any filters
  const hasFilters = searchState.filters.length > 0;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!name.trim()) {
        toast.error("Every room needs a name");
        return;
      }

      const filters = searchState.filters;
      if (roomType === "smart" && filters.length === 0) {
        toast.error("Dynamic rooms require at least one filter");
        return;
      }

      setIsCreating(true);
      try {
        const response = await fetch("/api/v1/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            emoji,
            type: roomType,
            filters: roomType === "smart" ? filters : null,
            visibility: "private",
          }),
        });

        if (response.ok) {
          const room = await response.json();

          // Mark milestones for room creation
          useMilestoneStore.getState().markComplete("create_first_room");
          if (shouldCompleteCreateDynamicRoom(roomType)) {
            useMilestoneStore.getState().markComplete("create_dynamic_room");
          }

          // Track room creation event
          posthog.capture("room_created", {
            room_id: room.id,
            room_type: roomType,
            has_emoji: !!emoji,
            filter_count: roomType === "smart" ? filters.length : 0,
          });

          toast.success("Room created");
          router.push(`/@${room.username}/${room.slug}`);
        } else {
          const data = await response.json();
          toast.error(data.message || "Failed to create room");
          setIsCreating(false);
        }
      } catch (error) {
        posthog.captureException(error);
        toast.error("Failed to create room");
        setIsCreating(false);
      }
    },
    [emoji, name, roomType, searchState.filters, router],
  );

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href="/rooms"
          className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to rooms
        </Link>
        <h1 className="font-semibold font-serif text-3xl">Create a new room</h1>
        <p className="text-pretty text-muted-foreground">
          Rooms allow you to group your items. Choose a dynamic room to
          automatically collect items matching your filters, or a static room to
          hand-pick specific items. Rooms are private by default, or you can
          share them with others.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Room Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Room name</Label>
          <div className="flex max-w-md items-center gap-2">
            <EmojiPickerPopover
              value={emoji}
              onChange={handleEmojiChange}
              placeholderEmoji={currentExample.emoji}
              isTransitioning={isTransitioning}
              isPulsing={isWaitingForEmoji}
              onSelect={() => nameInputRef.current?.focus()}
            />
            <div className="relative flex-1">
              <Input
                ref={nameInputRef}
                id="name"
                value={name}
                onChange={handleNameChange}
                className="w-full"
              />
              {/* Custom animated placeholder overlay */}
              {!name && (
                <div
                  className={cn(
                    "pointer-events-none absolute inset-0 flex items-center px-3 text-muted-foreground transition-opacity",
                    isTransitioning ? "opacity-0" : "opacity-100",
                  )}
                  style={{ transitionDuration: `${FADE_DURATION}ms` }}
                >
                  {currentExample.name}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Room Type */}
        <div className="space-y-3">
          <Label>Room type</Label>
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setRoomType("manual")}
              className={`group flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
                roomType === "manual"
                  ? "border-primary bg-primary/5"
                  : "cursor-pointer border-border hover:border-muted-foreground/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Hand
                  className={`size-5 ${roomType === "manual" ? "text-primary" : "text-muted-foreground"}`}
                />
                <span className="font-medium">Static Room</span>
              </div>
              <p className="text-muted-foreground text-sm">
                Hand-pick specific items to add to this room
              </p>
            </button>

            <button
              type="button"
              onClick={() => setRoomType("smart")}
              className={`group flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
                roomType === "smart"
                  ? "border-amber-500 bg-amber-500/5"
                  : "cursor-pointer border-border hover:border-amber-500/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Sparkles
                  className={`size-5 transition-colors ${
                    roomType === "smart"
                      ? "text-amber-500"
                      : "text-amber-500/50 group-hover:text-amber-500"
                  }`}
                />
                <span className="font-medium">Dynamic Room</span>
              </div>
              <p className="text-muted-foreground text-sm">
                Automatically collects items that match your filters
              </p>
            </button>
          </div>
        </div>

        {/* Filters (for smart rooms) */}
        {roomType === "smart" && (
          <div className="space-y-4">
            <div>
              <Label>Filters</Label>
              <p className="mt-1 text-muted-foreground text-sm">
                Add filters to define which items belong in this room. Items
                matching all filters will be automatically added.
              </p>
            </div>

            <SearchInput
              value={searchState}
              onChange={setSearchState}
              getFilterValues={getFilterValuesForType}
              placeholder="Add filters"
            />

            {!hasFilters && (
              <p className="text-muted-foreground text-sm italic">
                Type @ to add a filter, or click the filter button on mobile
              </p>
            )}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <CreateRoomButton
            isCreating={isCreating}
            hasName={!!name.trim()}
            hasFilters={hasFilters}
            roomType={roomType}
          />
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

type CreateRoomButtonProps = {
  isCreating: boolean;
  hasName: boolean;
  hasFilters: boolean;
  roomType: "smart" | "manual";
};

function CreateRoomButton({
  isCreating,
  hasName,
  hasFilters,
  roomType,
}: CreateRoomButtonProps) {
  const missingName = !hasName;
  const missingFilters = roomType === "smart" && !hasFilters;
  const isDisabled = missingName || missingFilters;

  // Determine tooltip message (prioritize name over filters)
  const tooltipMessage = missingName
    ? "Every room needs a name"
    : missingFilters
      ? "Dynamic rooms require at least one filter"
      : null;

  if (isDisabled && tooltipMessage) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button type="button" disabled>
              <Plus className="size-4" />
              Create room
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipMessage}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button type="submit" disabled={isCreating}>
      {isCreating ? (
        <IsLoading label="Creating" />
      ) : (
        <>
          <Plus className="size-4" />
          Create room
        </>
      )}
    </Button>
  );
}
