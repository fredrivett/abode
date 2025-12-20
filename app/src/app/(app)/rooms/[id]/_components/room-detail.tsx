"use client";

import { BalancedMasonryGrid, Frame } from "@masonry-grid/react";
import type {
  ItemKind,
  ProcessingStatus,
  RoomType,
  RoomVisibility,
  SourceType,
} from "@prisma/client";
import { ArrowLeft, Loader2, SearchX, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { RoomFilterEditor } from "@/components/rooms/room-filter-editor";
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
import { EditableTitle } from "@/components/ui/editable-title";
import { IsLoading } from "@/components/ui/is-loading";
import type { Filter } from "@/lib/search/types";
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
  filters: Filter[] | null;
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="space-y-2 flex-1">
          <Link
            href="/rooms"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to rooms
          </Link>
          <div className="flex items-center gap-3">
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

        <Button
          variant="destructive-outline"
          size="sm"
          onClick={() => setShowDeleteDialog(true)}
        >
          <Trash2 className="size-4" />
          Delete room
        </Button>
      </div>

      {/* Filter editor for smart rooms */}
      {room.type === "smart" && roomFilters && (
        <RoomFilterEditor
          filters={roomFilters}
          onSave={async (newFilters) => {
            // Save to API
            const response = await fetch(`/api/v1/rooms/${room.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ filters: newFilters }),
            });

            if (!response.ok) {
              throw new Error("Failed to save filters");
            }

            // Update local state
            setRoomFilters(newFilters);

            // Refresh items after filter change
            try {
              const itemsResponse = await fetch(
                `/api/v1/rooms/${room.id}/items`,
              );
              if (itemsResponse.ok) {
                const data = await itemsResponse.json();
                setItems(data.items);
                setCursor(data.nextCursor);
                setHasMore(data.hasMore);
              } else {
                toast.error("Failed to refresh items");
              }
            } catch {
              toast.error("Failed to refresh items");
            }
          }}
        />
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
    </div>
  );
}
