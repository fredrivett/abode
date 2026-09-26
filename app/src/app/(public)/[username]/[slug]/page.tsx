import type { RoomType, RoomVisibility } from "@prisma/client";
import { notFound } from "next/navigation";
import { cache } from "react";
import { signOut } from "@/lib/actions/auth";
import db from "@/lib/db";
import { roomItemSelect, toClientRoomItem } from "@/lib/rooms/room-item-query";
import type { Filter } from "@/lib/search/types";
import { getAuthenticatedUser } from "@/lib/user";
import { RoomPageClient } from "./_components/room-page-client";

type Props = {
  params: Promise<{ username: string; slug: string }>;
};

// Parse and validate the username from the route param
// Returns the username without @ prefix, or null if invalid (missing @ prefix)
function parseUsername(rawUsername: string): string | null {
  // Next.js passes URL-encoded params, so %40 needs to be decoded to @
  const decoded = decodeURIComponent(rawUsername);
  if (!decoded.startsWith("@")) {
    return null;
  }
  return decoded.slice(1);
}

const getUser = cache(async (username: string) => {
  return db.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
    },
  });
});

const getRoom = cache(async (userId: string, slug: string) => {
  return db.room.findFirst({
    where: {
      userId,
      slug: {
        equals: slug,
        mode: "insensitive",
      },
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
      userId: true,
      _count: {
        select: { roomItems: true },
      },
    },
  });
});

export async function generateMetadata({ params }: Props) {
  const { username: rawUsername, slug } = await params;
  const username = parseUsername(rawUsername);

  if (!username) {
    return { title: "User not found" };
  }

  const user = await getUser(username);

  if (!user) {
    return { title: "User not found" };
  }

  const room = await getRoom(user.id, slug);

  if (!room) {
    return { title: "Room not found" };
  }

  return {
    title: `${room.name} | @${user.username} | abode`,
    description: `${room.name} - a room by @${user.username}`,
  };
}

export default async function RoomPage({ params }: Props) {
  const { username: rawUsername, slug } = await params;
  const username = parseUsername(rawUsername);

  // Only match URLs with @ prefix (e.g., /@fred/room, not /fred/room)
  if (!username) {
    notFound();
  }

  // Get the user by username
  const user = await getUser(username);
  if (!user) {
    notFound();
  }

  // Get the room by user + slug
  const room = await getRoom(user.id, slug);
  if (!room) {
    notFound();
  }

  // Get current user for header (uses cached fetcher)
  const currentUser = await getAuthenticatedUser();
  const isOwner = currentUser?.id === room.userId;

  // Private rooms are only visible to owner
  if (room.visibility === "private" && !isOwner) {
    notFound();
  }

  const PAGE_SIZE = 100;

  // Fetch room items with their associated items. Non-owners only see items
  // that are actually publicly viewable in this room: an item opted out of
  // public rooms (`excludeFromPublicRooms`) isn't viewable per `canViewItem`,
  // so it must not appear here — otherwise its now-public reading data leaks.
  const roomItems = await db.roomItem.findMany({
    where: {
      roomId: room.id,
      ...(isOwner ? {} : { item: { excludeFromPublicRooms: false } }),
    },
    take: PAGE_SIZE + 1,
    orderBy: { addedAt: "desc" },
    select: roomItemSelect,
  });

  const hasMore = roomItems.length > PAGE_SIZE;
  const paginatedRoomItems = hasMore
    ? roomItems.slice(0, PAGE_SIZE)
    : roomItems;
  const nextCursor = hasMore
    ? (paginatedRoomItems[paginatedRoomItems.length - 1]?.id ?? null)
    : null;

  // Count only what the viewer can actually see: the grid filters out excluded
  // items for non-owners (above), so the header count must use the same
  // predicate or it reveals that hidden items exist.
  const itemCount = isOwner
    ? room._count.roomItems
    : await db.roomItem.count({
        where: { roomId: room.id, item: { excludeFromPublicRooms: false } },
      });

  const roomForClient = {
    id: room.id,
    name: room.name,
    emoji: room.emoji,
    slug: room.slug,
    type: room.type as RoomType,
    filters: room.filters as Filter[] | null,
    visibility: room.visibility as RoomVisibility,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
    itemCount,
  };

  const itemsForClient = paginatedRoomItems.map(toClientRoomItem);

  return (
    <RoomPageClient
      room={roomForClient}
      initialItems={itemsForClient}
      initialCursor={nextCursor}
      initialHasMore={hasMore}
      isOwner={isOwner}
      isAuthenticated={!!currentUser}
      userId={currentUser?.id ?? null}
      email={currentUser?.email ?? null}
      firstName={currentUser?.firstName ?? null}
      lastName={currentUser?.lastName ?? null}
      username={currentUser?.username ?? null}
      avatarUrl={currentUser?.avatarUrl ?? null}
      availableInvites={currentUser?.availableInvites ?? 0}
      signOutAction={currentUser ? signOut : undefined}
      roomOwner={{
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      }}
    />
  );
}
