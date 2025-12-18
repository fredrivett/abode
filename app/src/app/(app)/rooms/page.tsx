import db from "@/lib/db";
import type { RoomFilters } from "@/lib/rooms";
import { createClient } from "@/lib/supabase/server";
import { getUserWithMetadata } from "@/lib/supabase/user-metadata";
import { DashboardHeader } from "../_components/dashboard-header";
import { signOut } from "../dashboard/actions";
import { RoomsList } from "./_components/rooms-list";

export default async function RoomsPage() {
  const supabase = await createClient();
  const { user, metadata } = await getUserWithMetadata(supabase);

  // Fetch rooms for the user
  const rooms = user
    ? await db.room.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          name: true,
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

  const roomsForClient = rooms.map((room) => ({
    id: room.id,
    name: room.name,
    type: room.type,
    filters: room.filters as RoomFilters | null,
    visibility: room.visibility,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
    itemCount: room._count.roomItems,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <DashboardHeader
        email={metadata.email}
        firstName={metadata.firstName}
        lastName={metadata.lastName}
        avatarUrl={metadata.avatarUrl}
        signOutAction={signOut}
      />

      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <RoomsList initialRooms={roomsForClient} />
      </div>
    </div>
  );
}
