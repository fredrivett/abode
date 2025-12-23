"use client";

import { DoorOpen, Hand, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { FilterBadges } from "@/components/rooms/filter-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RoomWithSlug } from "@/lib/types/room";

type RoomsListProps = {
  initialRooms: RoomWithSlug[];
  username: string;
};

export function RoomsList({ initialRooms, username }: RoomsListProps) {
  const rooms = initialRooms;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-serif font-semibold">
            <DoorOpen className="size-6 text-muted-foreground" />
            Rooms
          </h2>
          <p className="text-sm text-muted-foreground">
            Organize your items into dynamic or static collections
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
            <DoorOpen className="size-14 text-muted-foreground" />
            <div className="space-y-2">
              <h2 className="text-3xl font-serif font-semibold">
                No rooms yet
              </h2>
              <p className="text-base text-muted-foreground">
                Create your first room to start organizing your items. Dynamic
                rooms automatically collect items matching your filters, while
                static rooms let you hand-pick specific items.
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
                <h3 className="flex items-center gap-2 text-lg font-serif font-medium leading-none">
                  {room.emoji && <span aria-hidden>{room.emoji}</span>}
                  {room.name}
                </h3>
                {room.visibility === "public" && (
                  <Badge variant="secondary" className="text-xs">
                    Public
                  </Badge>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
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
    </div>
  );
}
