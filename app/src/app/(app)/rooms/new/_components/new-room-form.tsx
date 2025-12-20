"use client";

import { ArrowLeft, Blocks, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { SearchInput } from "@/components/search/search-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IsLoading } from "@/components/ui/is-loading";
import type { SearchState } from "@/lib/search/types";
import { useFilterOptions } from "@/lib/search/use-filter-options";

export function NewRoomForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roomType, setRoomType] = useState<"smart" | "manual">("smart");
  const [searchState, setSearchState] = useState<SearchState>({
    query: "",
    filters: [],
  });
  const [isCreating, setIsCreating] = useState(false);

  // Get filter options for autocomplete
  const { getFilterValuesForType } = useFilterOptions();

  // Check if we have any filters
  const hasFilters = searchState.filters.length > 0;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!name.trim()) {
        toast.error("Please enter a room name");
        return;
      }

      const filters = searchState.filters;
      if (roomType === "smart" && filters.length === 0) {
        toast.error("Smart rooms require at least one filter");
        return;
      }

      setIsCreating(true);
      try {
        const response = await fetch("/api/v1/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            type: roomType,
            filters: roomType === "smart" ? filters : null,
            visibility: "private",
          }),
        });

        if (response.ok) {
          const room = await response.json();
          toast.success("Room created");
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
    },
    [name, roomType, searchState.filters, router],
  );

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href="/rooms"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to rooms
        </Link>
        <h1 className="text-3xl font-serif font-semibold">Create a new room</h1>
        <p className="text-muted-foreground">
          Organize your items into smart or manual collections
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Room Name */}
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            Room name
          </label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Collection"
            className="max-w-md"
          />
        </div>

        {/* Room Type */}
        <div className="space-y-3">
          <span className="block text-sm font-medium">Room type</span>
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setRoomType("smart")}
              className={`flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
                roomType === "smart"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Sparkles
                  className={`size-5 ${roomType === "smart" ? "text-amber-500" : "text-muted-foreground"}`}
                />
                <span className="font-medium">Smart Room</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Automatically collects items that match your filters
              </p>
            </button>

            <button
              type="button"
              onClick={() => setRoomType("manual")}
              className={`flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
                roomType === "manual"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Blocks
                  className={`size-5 ${roomType === "manual" ? "text-primary" : "text-muted-foreground"}`}
                />
                <span className="font-medium">Manual Room</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Hand-pick specific items to add to this room
              </p>
            </button>
          </div>
        </div>

        {/* Filters (for smart rooms) */}
        {roomType === "smart" && (
          <div className="space-y-4">
            <div>
              <span className="block text-sm font-medium">Filters</span>
              <p className="text-sm text-muted-foreground mt-1">
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
              <p className="text-sm text-muted-foreground italic">
                Type @ to add a filter, or click the filter button on mobile
              </p>
            )}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={isCreating || (roomType === "smart" && !hasFilters)}
          >
            {isCreating ? (
              <IsLoading label="Creating" />
            ) : (
              <>
                <Plus className="size-4" />
                Create room
              </>
            )}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
