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
  Pencil,
  SearchX,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
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
import { EditableTitle } from "@/components/ui/editable-title";
import { IsLoading } from "@/components/ui/is-loading";
import type { RoomFilters } from "@/lib/rooms";
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

export function RoomDetail({ room, initialItems }: RoomDetailProps) {
  const router = useRouter();
  const [roomName, setRoomName] = useState(room.name);
  const [items] = useState(initialItems);
  const [isSavingName, setIsSavingName] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
      {room.type === "smart" && room.filters && (
        <div className="flex flex-wrap gap-2">
          {renderFilterBadges(room.filters)}
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
        <BalancedMasonryGrid
          frameWidth={250}
          gap={16}
          style={{ overflow: "visible !important" }}
        >
          {items.map((item) => {
            const meta = item.meta || {};
            const isArticle = item.kind === "article";

            // For articles, prefer title; for images, prefer meta name
            const name = isArticle
              ? (item.title ?? item.articleDetails?.domain ?? "Untitled")
              : ((meta.name as string | undefined) ??
                (meta.originalName as string | undefined) ??
                item.title ??
                item.fileKey ??
                "Untitled");

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

      {/* Edit filters dialog (placeholder for now) */}
      <EditFiltersDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        room={room}
        onFiltersUpdate={() => router.refresh()}
      />
    </div>
  );
}

function renderFilterBadges(filters: RoomFilters) {
  const badges: React.ReactNode[] = [];
  let key = 0;

  if (filters.type?.length) {
    for (const f of filters.type) {
      badges.push(
        <Badge key={key++} variant="outline">
          {f.negated ? "!" : ""}type:{f.value}
        </Badge>,
      );
    }
  }

  if (filters.tag?.length) {
    for (const f of filters.tag) {
      badges.push(
        <Badge key={key++} variant="outline">
          {f.negated ? "!" : ""}#{f.value}
        </Badge>,
      );
    }
  }

  if (filters.object?.length) {
    for (const f of filters.object) {
      badges.push(
        <Badge key={key++} variant="outline">
          {f.negated ? "!" : ""}object:{f.value}
        </Badge>,
      );
    }
  }

  if (filters.color?.length) {
    for (const f of filters.color) {
      badges.push(
        <Badge key={key++} variant="outline">
          {f.negated ? "!" : ""}color:{f.value}
        </Badge>,
      );
    }
  }

  if (filters.source?.length) {
    for (const f of filters.source) {
      badges.push(
        <Badge key={key++} variant="outline">
          {f.negated ? "!" : ""}source:{f.value}
        </Badge>,
      );
    }
  }

  if (filters.location?.length) {
    for (const f of filters.location) {
      badges.push(
        <Badge key={key++} variant="outline">
          {f.negated ? "!" : ""}location:{f.value}
        </Badge>,
      );
    }
  }

  if (filters.dateAfter) {
    badges.push(
      <Badge key={key++} variant="outline">
        after:{filters.dateAfter}
      </Badge>,
    );
  }

  if (filters.dateBefore) {
    badges.push(
      <Badge key={key++} variant="outline">
        before:{filters.dateBefore}
      </Badge>,
    );
  }

  return badges;
}

type EditFiltersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room;
  onFiltersUpdate: () => void;
};

function EditFiltersDialog({
  open,
  onOpenChange,
  room,
  onFiltersUpdate,
}: EditFiltersDialogProps) {
  const [filtersJson, setFiltersJson] = useState(
    JSON.stringify(room.filters, null, 2),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    let parsedFilters: RoomFilters;
    try {
      parsedFilters = JSON.parse(filtersJson);
    } catch {
      setError("Invalid JSON format");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters: parsedFilters }),
      });
      if (response.ok) {
        toast.success("Filters updated");
        onOpenChange(false);
        onFiltersUpdate();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Room Filters</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Edit the JSON filters for this smart room. Changes will trigger a
            re-sync of all matching items.
          </p>
          <textarea
            className="w-full h-64 p-3 font-mono text-sm rounded-md border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            value={filtersJson}
            onChange={(e) => setFiltersJson(e.target.value)}
          />
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
