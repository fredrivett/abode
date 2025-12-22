import { DashboardHeader } from "@/components/layout/dashboard-header";
import db from "@/lib/db";
import type { Filter } from "@/lib/search/types";
import { createClient } from "@/lib/supabase/server";
import { getUserWithMetadata } from "@/lib/supabase/user-metadata";
import type { RoomWithSlug } from "@/lib/types/room";
import { RoomsList } from "./_components/rooms-list";

export default async function RoomsPage() {
  const supabase = await createClient();
  const { user } = await getUserWithMetadata(supabase);

  // Get the user's username
  const dbUser = user
    ? await db.user.findUnique({
        where: { id: user.id },
        select: { username: true },
      })
    : null;

  // Fetch rooms for the user (only those with slugs)
  const rooms = user
    ? await db.room.findMany({
        where: {
          userId: user.id,
          slug: { not: null },
        },
        select: {
          id: true,
          name: true,
          emoji: true,
          slug: true,
          type: true,
          filters: true,
          visibility: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { roomItems: true },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const username = dbUser?.username;

  // If no username, we can't show rooms with the new URL format
  if (!username) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-background">
        <DashboardHeader />
        <div className="mx-auto w-full max-w-5xl px-4 py-8">
          <RoomsList initialRooms={[]} username="" />
        </div>
      </div>
    );
  }

  const roomsForClient: RoomWithSlug[] = rooms.map((room) => ({
    id: room.id,
    name: room.name,
    emoji: room.emoji,
    slug: room.slug as string, // We filtered for not null above
    type: room.type,
    filters: room.filters as Filter[] | null,
    visibility: room.visibility,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
    itemCount: room._count.roomItems,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <DashboardHeader />

      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <RoomsList initialRooms={roomsForClient} username={username} />
      </div>
    </div>
  );
}
