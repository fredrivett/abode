"use client";

import { BalancedMasonryGrid, Frame } from "@masonry-grid/react";
import type { RoomVisibility } from "@prisma/client";
import {
  ArrowLeft,
  Hand,
  Loader2,
  MoreHorizontal,
  Pencil,
  SearchX,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ItemCard } from "@/app/(app)/dashboard/item-card";
import { EmojiPickerPopover } from "@/components/rooms/emoji-picker-popover";
import { ShareRoomDialog } from "@/components/rooms/share-room-dialog";
import { VisibilityToggle } from "@/components/rooms/visibility-toggle";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditableTitle } from "@/components/ui/editable-title";
import { Input } from "@/components/ui/input";
import { IsLoading } from "@/components/ui/is-loading";
import { ProfileTag } from "@/components/user/profile-tag";
import type { Room, RoomItem } from "@/lib/types/room";

type RoomOwner = {
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

type RoomDetailProps = {
  room: Room;
  initialItems: RoomItem[];
  initialCursor: string | null;
  initialHasMore: boolean;
  /** Whether the current user owns this room. Defaults to true for backwards compatibility. */
  isOwner?: boolean;
  /** Room owner info for display (only shown when not owner) */
  roomOwner?: RoomOwner;
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
  isOwner = true,
  roomOwner,
}: RoomDetailProps) {
  const router = useRouter();
  const [roomEmoji, setRoomEmoji] = useState(room.emoji);
  const [roomName, setRoomName] = useState(room.name);
  const [roomVisibility, setRoomVisibility] = useState(room.visibility);
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Edit dialog state
  const [editEmoji, setEditEmoji] = useState(room.emoji);
  const [editName, setEditName] = useState(room.name);
  const [editVisibility, setEditVisibility] = useState(room.visibility);

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

  const handleOpenEditDialog = () => {
    setEditEmoji(roomEmoji);
    setEditName(roomName);
    setEditVisibility(roomVisibility);
    setShowEditDialog(true);
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const updates: {
        name?: string;
        emoji?: string | null;
        visibility?: RoomVisibility;
      } = {};

      if (editEmoji !== roomEmoji) {
        updates.emoji = editEmoji;
      }
      if (editName.trim() !== roomName) {
        updates.name = editName.trim();
      }
      if (editVisibility !== roomVisibility) {
        updates.visibility = editVisibility;
      }

      if (Object.keys(updates).length === 0) {
        setShowEditDialog(false);
        return;
      }

      const response = await fetch(`/api/v1/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        if (updates.emoji !== undefined) setRoomEmoji(updates.emoji);
        if (updates.name) setRoomName(updates.name);
        if (updates.visibility) setRoomVisibility(updates.visibility);
        toast.success("Room settings updated");
        setShowEditDialog(false);
      } else {
        toast.error("Failed to update room settings");
      }
    } catch {
      toast.error("Failed to update room settings");
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex-1 space-y-2">
          {isOwner && (
            <Link
              href="/rooms"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to rooms
            </Link>
          )}
          <div className="flex items-center gap-3">
            {roomEmoji && (
              <span className="text-3xl" aria-hidden>
                {roomEmoji}
              </span>
            )}
            {isOwner ? (
              <EditableTitle
                value={roomName}
                onSubmit={handleNameSubmit}
                size="2xl"
                isSaving={isSavingName}
              />
            ) : (
              <h1 className="font-serif text-3xl font-semibold">{roomName}</h1>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {room.itemCount} {room.itemCount === 1 ? "item" : "items"}
            </span>
            {room.type === "smart" ? (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="size-3" />
                  Dynamic
                </span>
              </>
            ) : (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Hand className="size-3" />
                  Static
                </span>
              </>
            )}
            {roomVisibility === "public" && (
              <>
                <span>·</span>
                <Badge variant="secondary" className="text-xs">
                  Public
                </Badge>
              </>
            )}
          </div>
        </div>

        {isOwner ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Room options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowShareDialog(true)}>
                <Share2 className="size-4" />
                Share room
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleOpenEditDialog}>
                <Pencil className="size-4" />
                Edit room
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="size-4" />
                Delete room
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          roomOwner && <ProfileTag user={roomOwner} />
        )}
      </div>

      {/* Items grid */}
      {items.length === 0 ? (
        <div className="flex min-h-[calc(100vh-20rem)] w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
          <div className="mx-auto flex max-w-lg flex-col items-center gap-4">
            <SearchX className="size-14 text-muted-foreground" />
            <div className="space-y-2">
              <h2 className="font-serif text-3xl font-semibold">
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
                    useProxyUrl={!isOwner}
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

      {/* Edit room dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit room</DialogTitle>
            <DialogDescription>
              Update your room's name and visibility settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="editRoomName" className="text-sm font-medium">
                Room name
              </label>
              <div className="flex items-center gap-2">
                <EmojiPickerPopover value={editEmoji} onChange={setEditEmoji} />
                <Input
                  id="editRoomName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="My Collection"
                />
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium">Visibility</span>
              <VisibilityToggle
                value={editVisibility}
                onChange={setEditVisibility}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={isSavingSettings}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} disabled={isSavingSettings}>
              {isSavingSettings ? <IsLoading label="Saving" /> : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Share room dialog */}
      {roomOwner?.username && (
        <ShareRoomDialog
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
          room={{
            id: room.id,
            slug: room.slug,
            name: roomName,
            emoji: roomEmoji,
            visibility: roomVisibility,
            itemCount: room.itemCount,
            filters: room.filters,
          }}
          username={roomOwner.username}
          items={items}
        />
      )}
    </div>
  );
}
