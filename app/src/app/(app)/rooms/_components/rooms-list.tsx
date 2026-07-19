"use client";

import { DoorOpen, Plus } from "lucide-react";
import Link from "next/link";
import { RoomCard } from "@/components/rooms/room-card";
import { Button } from "@/components/ui/button";
import type { RoomWithSlug } from "@/lib/types/room";

type RoomsListProps = {
  initialRooms: RoomWithSlug[];
  username: string;
};

/**
 * Displays the user's rooms as a grid of cards with type badges and filter previews.
 *
 * Shows an empty-state prompt when no rooms exist.
 */
export function RoomsList({ initialRooms, username }: RoomsListProps) {
  const rooms = initialRooms;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-semibold font-serif text-2xl">
            <DoorOpen className="size-6 text-muted-foreground" />
            Rooms
          </h2>
          <p className="text-muted-foreground text-sm">
            Group your items into dynamic or static rooms
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
        <div className="flex min-h-[calc(100vh-20rem)] w-full items-center justify-center rounded-xl border border-border border-dashed bg-muted/20 px-6 py-12 text-center">
          <div className="mx-auto flex max-w-lg flex-col items-center gap-4">
            <DoorOpen className="size-14 text-muted-foreground" />
            <div className="space-y-2">
              <h2 className="font-semibold font-serif text-3xl">
                No rooms yet
              </h2>
              <p className="text-base text-muted-foreground">
                Rooms allow you to group your items. Dynamic rooms automatically
                collect items matching your filters, while static rooms let you
                hand-pick specific items. Rooms are private by default, or you
                can share them.
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
            <RoomCard
              key={room.id}
              href={`/@${username}/${room.slug}`}
              name={room.name}
              emoji={room.emoji}
              itemCount={room.itemCount}
              type={room.type}
              showPublicBadge={room.visibility === "public"}
              filters={room.filters}
            />
          ))}
        </div>
      )}
    </div>
  );
}
