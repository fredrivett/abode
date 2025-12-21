"use client";

import type { RoomType, RoomVisibility } from "@prisma/client";
import { Blocks, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
import type { Filter } from "@/lib/search/types";

export type RoomForList = {
  id: string;
  name: string;
  slug: string;
  type: RoomType;
  filters: Filter[] | null;
  visibility: RoomVisibility;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
};

type RoomsListProps = {
  initialRooms: RoomForList[];
  username: string;
};

export function RoomsList({ initialRooms, username }: RoomsListProps) {
  const [rooms, setRooms] = useState(initialRooms);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (roomId: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/rooms/${roomId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setRooms((prev) => prev.filter((r) => r.id !== roomId));
      }
    } finally {
      setIsDeleting(false);
      setDeletingRoomId(null);
    }
  };

  const roomToDelete = rooms.find((r) => r.id === deletingRoomId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-semibold">Rooms</h2>
          <p className="text-sm text-muted-foreground">
            Organize your items into smart or manual collections
          </p>
        </div>
        <Button asChild>
          <Link href="/rooms/new">
            <Plus className="size-4" />
            Create Room
          </Link>
        </Button>
      </div>

      {rooms.length === 0 ? (
        <div className="flex min-h-[calc(100vh-20rem)] w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
          <div className="mx-auto flex max-w-lg flex-col items-center gap-4">
            <Blocks className="size-14 text-muted-foreground" />
            <div className="space-y-2">
              <h2 className="text-3xl font-serif font-semibold">
                No rooms yet
              </h2>
              <p className="text-base text-muted-foreground">
                Create your first room to start organizing your items. Smart
                rooms automatically collect items matching your filters, while
                manual rooms let you hand-pick specific items.
              </p>
              <Button asChild className="mt-4">
                <Link href="/rooms/new">
                  <Plus className="size-4" />
                  Create your first room
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <Link
              key={room.id}
              href={`/@${username}/${room.slug}`}
              className="group relative flex flex-col rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-serif font-medium leading-none">
                  {room.name}
                </h3>
                <div className="flex items-center gap-1">
                  {room.visibility === "public" && (
                    <Badge variant="secondary" className="text-xs">
                      Public
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeletingRoomId(room.id);
                    }}
                  >
                    <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {room.itemCount} {room.itemCount === 1 ? "item" : "items"}
                </span>
                {room.type === "smart" && (
                  <>
                    <span>·</span>
                    <span>Auto-updating</span>
                  </>
                )}
              </div>
              {room.type === "smart" && room.filters && (
                <div className="mt-3 flex flex-wrap gap-1">
                  <FilterBadges filters={room.filters} compact />
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      <AlertDialog
        open={deletingRoomId !== null}
        onOpenChange={(open) => !open && setDeletingRoomId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete room?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{roomToDelete?.name}"? This will
              remove the room but won't delete the items in it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={() => deletingRoomId && handleDelete(deletingRoomId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
