"use client";

import { ArrowLeft, Blocks, Plus, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IsLoading } from "@/components/ui/is-loading";
import type { FilterValue, RoomFilters } from "@/lib/rooms";

type FilterType = "type" | "tag" | "object" | "color" | "source" | "location";

const FILTER_TYPES: {
  value: FilterType;
  label: string;
  placeholder: string;
}[] = [
  { value: "type", label: "Type", placeholder: "e.g., image, article" },
  { value: "tag", label: "Tag", placeholder: "e.g., travel, food" },
  { value: "object", label: "Object", placeholder: "e.g., car, dog" },
  { value: "color", label: "Color", placeholder: "e.g., blue, #ff0000" },
  { value: "source", label: "Source", placeholder: "e.g., upload, screenshot" },
  { value: "location", label: "Location", placeholder: "e.g., London, Japan" },
];

export function NewRoomForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roomType, setRoomType] = useState<"smart" | "manual">("smart");
  const [filters, setFilters] = useState<RoomFilters>({});
  const [isCreating, setIsCreating] = useState(false);

  // For adding new filters
  const [selectedFilterType, setSelectedFilterType] =
    useState<FilterType>("type");
  const [filterValue, setFilterValue] = useState("");
  const [isNegated, setIsNegated] = useState(false);

  const addFilter = () => {
    const trimmed = filterValue.trim();
    if (!trimmed) return;

    const newFilter: FilterValue = {
      value: trimmed,
      negated: isNegated,
    };

    setFilters((prev) => ({
      ...prev,
      [selectedFilterType]: [...(prev[selectedFilterType] || []), newFilter],
    }));

    setFilterValue("");
    setIsNegated(false);
  };

  const removeFilter = (type: FilterType, index: number) => {
    setFilters((prev) => {
      const current = prev[type] || [];
      const updated = current.filter((_, i) => i !== index);
      if (updated.length === 0) {
        const { [type]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [type]: updated };
    });
  };

  const hasFilters = Object.values(filters).some(
    (arr) => arr && arr.length > 0,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter a room name");
      return;
    }

    if (roomType === "smart" && !hasFilters) {
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
  };

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

            {/* Current filters */}
            {hasFilters && (
              <div className="flex flex-wrap gap-2 p-4 rounded-lg border bg-muted/30">
                {(Object.entries(filters) as [FilterType, FilterValue[]][]).map(
                  ([type, values]) =>
                    values?.map((filter, filterIndex) => (
                      <Badge
                        key={`${type}-${filter.value}-${filter.negated}`}
                        variant="secondary"
                        className="gap-1 pr-1"
                      >
                        {filter.negated && "!"}
                        {type}:{filter.value}
                        <button
                          type="button"
                          onClick={() => removeFilter(type, filterIndex)}
                          className="ml-1 rounded-full p-0.5 hover:bg-muted"
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    )),
                )}
              </div>
            )}

            {/* Add filter form */}
            <div className="flex flex-wrap gap-2 items-end">
              <div className="space-y-1.5">
                <label
                  htmlFor="filterType"
                  className="text-xs text-muted-foreground"
                >
                  Filter type
                </label>
                <select
                  id="filterType"
                  value={selectedFilterType}
                  onChange={(e) =>
                    setSelectedFilterType(e.target.value as FilterType)
                  }
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                  {FILTER_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[200px] space-y-1.5">
                <label
                  htmlFor="filterValue"
                  className="text-xs text-muted-foreground"
                >
                  Value
                </label>
                <Input
                  id="filterValue"
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  placeholder={
                    FILTER_TYPES.find((t) => t.value === selectedFilterType)
                      ?.placeholder
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addFilter();
                    }
                  }}
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isNegated}
                    onChange={(e) => setIsNegated(e.target.checked)}
                    className="rounded border-muted-foreground"
                  />
                  Exclude
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addFilter}
                  disabled={!filterValue.trim()}
                >
                  <Plus className="size-4" />
                  Add
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
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
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
