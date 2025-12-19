"use client";

import { BalancedMasonryGrid, Frame } from "@masonry-grid/react";
import type {
  ItemKind,
  ProcessingStatus,
  RoomType,
  RoomVisibility,
  SourceType,
} from "@prisma/client";
import {
  ArrowLeft,
  Blocks,
  Loader2,
  Pencil,
  Plus,
  SearchX,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FilterBadges } from "@/components/rooms/filter-badges";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditableTitle } from "@/components/ui/editable-title";
import { Input } from "@/components/ui/input";
import { IsLoading } from "@/components/ui/is-loading";
import type { FilterValue, RoomFilters } from "@/lib/rooms";
import type { ImageColor } from "@/lib/vision";
import { ItemCard } from "../../../dashboard/item-card";

type ItemLocation = {
  id: string;
  source: string;
  latitude: number | null;
  longitude: number | null;
  neighborhood: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  formatted: string | null;
};

type ArticleDetails = {
  author: string | null;
  domain: string | null;
  publishedAt: string | null;
  readingTime: number | null;
  content: string | null;
};

type RoomItem = {
  roomItemId: string;
  addedAt: string;
  id: string;
  kind: ItemKind | null;
  processingStatus: ProcessingStatus;
  fileKey: string | null;
  meta: Record<string, unknown> | null;
  sourceType: SourceType | null;
  sourceUrl: string | null;
  coverFileKey: string | null;
  createdAt: string;
  title: string | null;
  description: string | null;
  tags: string[];
  objects: string[];
  colors: ImageColor[];
  ocrText: string | null;
  captureDate: string | null;
  locations: ItemLocation[];
  articleDetails: ArticleDetails | null;
};

type Room = {
  id: string;
  name: string;
  type: RoomType;
  filters: RoomFilters | null;
  visibility: RoomVisibility;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
};

type RoomDetailProps = {
  room: Room;
  initialItems: RoomItem[];
  initialCursor: string | null;
  initialHasMore: boolean;
};

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${
    units[exponent]
  }`;
}

export function RoomDetail({
  room,
  initialItems,
  initialCursor,
  initialHasMore,
}: RoomDetailProps) {
  const router = useRouter();
  const [roomName, setRoomName] = useState(room.name);
  const [items, setItems] = useState(initialItems);
  const [roomFilters, setRoomFilters] = useState(room.filters);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadMoreItems = async () => {
    if (!hasMore || isLoadingMore || !cursor) return;

    setIsLoadingMore(true);
    try {
      const response = await fetch(
        `/api/v1/rooms/${room.id}/items?cursor=${cursor}`,
      );
      if (response.ok) {
        const data = await response.json();
        setItems((prev) => [...prev, ...data.items]);
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
      }
    } catch {
      toast.error("Failed to load more items");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleNameSubmit = async (nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === roomName.trim()) return;
    setIsSavingName(true);
    try {
      const response = await fetch(`/api/v1/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (response.ok) {
        setRoomName(trimmed);
        toast.success("Room name updated");
      } else {
        toast.error("Failed to update room name");
      }
    } catch {
      toast.error("Failed to update room name");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/rooms/${room.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast.success("Room deleted");
        router.push("/rooms");
      } else {
        toast.error("Failed to delete room");
        setIsDeleting(false);
      }
    } catch {
      toast.error("Failed to delete room");
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link
            href="/rooms"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to rooms
          </Link>
          <div className="flex items-center gap-3">
            {room.type === "smart" ? (
              <Sparkles className="size-6 text-amber-500" />
            ) : (
              <Blocks className="size-6 text-muted-foreground" />
            )}
            <EditableTitle
              value={roomName}
              onSubmit={handleNameSubmit}
              size="xl"
              isSaving={isSavingName}
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {room.itemCount} {room.itemCount === 1 ? "item" : "items"}
            </span>
            {room.type === "smart" && (
              <>
                <span>·</span>
                <span>Auto-updating</span>
              </>
            )}
            {room.visibility === "public" && (
              <>
                <span>·</span>
                <Badge variant="secondary" className="text-xs">
                  Public
                </Badge>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {room.type === "smart" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditDialog(true)}
            >
              <Pencil className="size-4" />
              Edit filters
            </Button>
          )}
          <Button
            variant="destructive-outline"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="size-4" />
            Delete room
          </Button>
        </div>
      </div>

      {/* Filter badges for smart rooms */}
      {room.type === "smart" && roomFilters && (
        <div className="flex flex-wrap gap-2">
          <FilterBadges filters={roomFilters} />
        </div>
      )}

      {/* Items grid */}
      {items.length === 0 ? (
        <div className="flex min-h-[calc(100vh-20rem)] w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
          <div className="mx-auto flex max-w-lg flex-col items-center gap-4">
            <SearchX className="size-14 text-muted-foreground" />
            <div className="space-y-2">
              <h2 className="text-3xl font-serif font-semibold">
                No items yet
              </h2>
              <p className="text-base text-muted-foreground">
                {room.type === "smart"
                  ? "No items currently match this room's filters. Items will appear here automatically when they match."
                  : "This room is empty. Add items to organize them here."}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <BalancedMasonryGrid
            frameWidth={250}
            gap={16}
            style={{ overflow: "visible !important" }}
          >
            {items.map((item) => {
              const meta = item.meta || {};
              const isArticle = item.kind === "article";

              // item.title is the single source of truth for display name
              const name = item.title ?? "Untitled";

              const size = formatBytes(meta.size as number | undefined);
              const mimeType = meta.type as string | undefined;

              // For articles, use 16:9 aspect ratio; for images use actual dimensions or 3:4
              const width = isArticle
                ? 16
                : ((meta.width as number | undefined) ?? 3);
              const height = isArticle
                ? 9
                : ((meta.height as number | undefined) ?? 4);

              return (
                <Frame key={item.id} width={width} height={height}>
                  <ItemCard
                    item={item}
                    name={name}
                    size={size}
                    mimeType={mimeType}
                  />
                </Frame>
              );
            })}
          </BalancedMasonryGrid>

          {/* Load more button */}
          {hasMore && (
            <div className="flex justify-center pt-8">
              <Button
                variant="outline"
                onClick={loadMoreItems}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete room?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{roomName}"? This will remove the
              room but won't delete the items in it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <IsLoading label="Deleting" /> : "Delete room"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit filters dialog */}
      <EditFiltersDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        room={room}
        roomFilters={roomFilters}
        onFiltersUpdate={async (newFilters) => {
          setRoomFilters(newFilters);
          // Fetch updated items after filter change (reset pagination)
          try {
            const response = await fetch(`/api/v1/rooms/${room.id}/items`);
            if (response.ok) {
              const data = await response.json();
              setItems(data.items);
              setCursor(data.nextCursor);
              setHasMore(data.hasMore);
            }
          } catch {
            // Silently fail - user can refresh to see updated items
          }
        }}
      />
    </div>
  );
}

type FilterCategory = keyof Omit<RoomFilters, "dateAfter" | "dateBefore">;

const FILTER_CATEGORIES: {
  key: FilterCategory;
  label: string;
  placeholder: string;
  icon: string;
}[] = [
  { key: "type", label: "Type", placeholder: "image or article", icon: "✳️" },
  { key: "tag", label: "Tag", placeholder: "e.g. landscape", icon: "🏷️" },
  { key: "object", label: "Object", placeholder: "e.g. tree", icon: "📦" },
  { key: "color", label: "Color", placeholder: "e.g. blue", icon: "🎨" },
  { key: "source", label: "Source", placeholder: "upload or url", icon: "🔗" },
  {
    key: "location",
    label: "Location",
    placeholder: "e.g. Paris",
    icon: "📍",
  },
];

type EditFiltersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room;
  roomFilters: RoomFilters | null;
  onFiltersUpdate: (filters: RoomFilters) => void;
};

function EditFiltersDialog({
  open,
  onOpenChange,
  room,
  roomFilters,
  onFiltersUpdate,
}: EditFiltersDialogProps) {
  const [filters, setFilters] = useState<RoomFilters>(roomFilters ?? {});
  const [newFilterType, setNewFilterType] = useState<FilterCategory | null>(
    null,
  );
  const [newFilterValue, setNewFilterValue] = useState("");
  const [newFilterNegated, setNewFilterNegated] = useState(false);
  const [dateAfter, setDateAfter] = useState(roomFilters?.dateAfter ?? "");
  const [dateBefore, setDateBefore] = useState(roomFilters?.dateBefore ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens (via prop change or internal action)
  useEffect(() => {
    if (open) {
      setFilters(roomFilters ?? {});
      setDateAfter(roomFilters?.dateAfter ?? "");
      setDateBefore(roomFilters?.dateBefore ?? "");
      setNewFilterType(null);
      setNewFilterValue("");
      setNewFilterNegated(false);
      setError(null);
    }
  }, [open, roomFilters]);

  const handleAddFilter = () => {
    if (!newFilterType || !newFilterValue.trim()) return;

    const newFilter: FilterValue = {
      value: newFilterValue.trim(),
      negated: newFilterNegated,
    };

    setFilters((prev) => ({
      ...prev,
      [newFilterType]: [...(prev[newFilterType] ?? []), newFilter],
    }));

    setNewFilterType(null);
    setNewFilterValue("");
    setNewFilterNegated(false);
  };

  const handleRemoveFilter = (category: FilterCategory, index: number) => {
    setFilters((prev) => {
      const updated = [...(prev[category] ?? [])];
      updated.splice(index, 1);
      return {
        ...prev,
        [category]: updated.length > 0 ? updated : undefined,
      };
    });
  };

  const handleSave = async () => {
    setError(null);

    // Build the final filters object
    const finalFilters: RoomFilters = { ...filters };
    if (dateAfter) finalFilters.dateAfter = dateAfter;
    if (dateBefore) finalFilters.dateBefore = dateBefore;

    // Clean up empty arrays
    for (const key of Object.keys(finalFilters) as (keyof RoomFilters)[]) {
      const value = finalFilters[key];
      if (Array.isArray(value) && value.length === 0) {
        delete finalFilters[key];
      }
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters: finalFilters }),
      });
      if (response.ok) {
        toast.success("Filters updated");
        onOpenChange(false);
        onFiltersUpdate(finalFilters);
      } else {
        const data = await response.json();
        setError(data.message || "Failed to update filters");
      }
    } catch {
      setError("Failed to update filters");
    } finally {
      setIsSaving(false);
    }
  };

  // Count total filters
  const totalFilters =
    Object.values(filters).reduce(
      (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
      0,
    ) +
    (dateAfter ? 1 : 0) +
    (dateBefore ? 1 : 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Room Filters</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Items matching all filters will automatically appear in this room.
          </p>

          {/* Current filters */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {FILTER_CATEGORIES.map((cat) =>
                (filters[cat.key] ?? []).map((f, idx) => (
                  <Badge
                    key={`${cat.key}-${idx}`}
                    variant="outline"
                    className="gap-1 pr-1"
                  >
                    <span className="opacity-70">{cat.label}:</span>
                    <span className={f.negated ? "line-through" : ""}>
                      {f.value}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-4 rounded-full p-0 hover:bg-destructive/20"
                      onClick={() => handleRemoveFilter(cat.key, idx)}
                    >
                      <X className="size-3" />
                    </Button>
                  </Badge>
                )),
              )}
              {dateAfter && (
                <Badge variant="outline" className="gap-1 pr-1">
                  <span className="opacity-70">After:</span>
                  <span>{dateAfter}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-4 rounded-full p-0 hover:bg-destructive/20"
                    onClick={() => setDateAfter("")}
                  >
                    <X className="size-3" />
                  </Button>
                </Badge>
              )}
              {dateBefore && (
                <Badge variant="outline" className="gap-1 pr-1">
                  <span className="opacity-70">Before:</span>
                  <span>{dateBefore}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-4 rounded-full p-0 hover:bg-destructive/20"
                    onClick={() => setDateBefore("")}
                  >
                    <X className="size-3" />
                  </Button>
                </Badge>
              )}
              {totalFilters === 0 && (
                <span className="text-sm text-muted-foreground italic">
                  No filters added yet
                </span>
              )}
            </div>
          </div>

          {/* Add new filter */}
          <div className="space-y-2 rounded-md border p-3">
            <div className="text-sm font-medium">Add filter</div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="min-w-[100px]">
                    {newFilterType
                      ? FILTER_CATEGORIES.find((c) => c.key === newFilterType)
                          ?.label
                      : "Select type"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {FILTER_CATEGORIES.map((cat) => (
                    <DropdownMenuItem
                      key={cat.key}
                      onClick={() => setNewFilterType(cat.key)}
                    >
                      <span className="mr-2">{cat.icon}</span>
                      {cat.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {newFilterType && (
                <>
                  <Input
                    placeholder={
                      FILTER_CATEGORIES.find((c) => c.key === newFilterType)
                        ?.placeholder
                    }
                    value={newFilterValue}
                    onChange={(e) => setNewFilterValue(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddFilter();
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewFilterNegated(!newFilterNegated)}
                    className={newFilterNegated ? "bg-destructive/10" : ""}
                  >
                    {newFilterNegated ? "Exclude" : "Include"}
                  </Button>
                  <Button size="sm" onClick={handleAddFilter}>
                    <Plus className="size-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Date filters */}
          <div className="space-y-2 rounded-md border p-3">
            <div className="text-sm font-medium">Date range (optional)</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="filter-date-after"
                  className="text-xs text-muted-foreground"
                >
                  After
                </label>
                <Input
                  id="filter-date-after"
                  type="date"
                  value={dateAfter}
                  onChange={(e) => setDateAfter(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label
                  htmlFor="filter-date-before"
                  className="text-xs text-muted-foreground"
                >
                  Before
                </label>
                <Input
                  id="filter-date-before"
                  type="date"
                  value={dateBefore}
                  onChange={(e) => setDateBefore(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <IsLoading label="Saving" /> : "Save filters"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
