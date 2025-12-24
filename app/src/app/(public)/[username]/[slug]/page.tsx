import type { RoomType, RoomVisibility } from "@prisma/client";
import { notFound } from "next/navigation";
import { cache } from "react";
import { signOut } from "@/lib/actions/auth";
import db from "@/lib/db";
import { getAvailableInvites } from "@/lib/invites";
import type { Filter } from "@/lib/search/types";
import { createClient } from "@/lib/supabase/server";
import { getUserWithMetadata } from "@/lib/supabase/user-metadata";
import type { ImageColor } from "@/lib/vision";
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

  // Check if current user is the owner and get user metadata for header
  const supabase = await createClient();
  const { user: currentUser, metadata } = await getUserWithMetadata(supabase);
  const isOwner = currentUser?.id === room.userId;

  // Get current user's DB info for header and available invites
  const [currentDbUser, availableInvites] = currentUser
    ? await Promise.all([
        db.user.findUnique({
          where: { id: currentUser.id },
          select: { username: true, avatarUrl: true },
        }),
        getAvailableInvites(currentUser.id),
      ])
    : [null, 0];

  // Private rooms are only visible to owner
  if (room.visibility === "private" && !isOwner) {
    notFound();
  }

  const PAGE_SIZE = 100;

  // Fetch room items with their associated items
  const roomItems = await db.roomItem.findMany({
    where: { roomId: room.id },
    take: PAGE_SIZE + 1,
    orderBy: { addedAt: "desc" },
    select: {
      id: true,
      addedAt: true,
      item: {
        select: {
          id: true,
          kind: true,
          processingStatus: true,
          fileKey: true,
          meta: true,
          sourceType: true,
          sourceUrl: true,
          coverFileKey: true,
          createdAt: true,
          title: true,
          description: true,
          tags: true,
          locations: {
            select: {
              id: true,
              source: true,
              latitude: true,
              longitude: true,
              neighborhood: true,
              city: true,
              region: true,
              country: true,
              countryCode: true,
              formatted: true,
            },
          },
          imageDetails: {
            select: {
              objects: true,
              colors: true,
              ocrText: true,
              captureDate: true,
            },
          },
          articleDetails: {
            select: {
              author: true,
              domain: true,
              publishedAt: true,
              readingTime: true,
              content: true,
            },
          },
        },
      },
    },
  });

  const hasMore = roomItems.length > PAGE_SIZE;
  const paginatedRoomItems = hasMore
    ? roomItems.slice(0, PAGE_SIZE)
    : roomItems;
  const nextCursor = hasMore
    ? (paginatedRoomItems[paginatedRoomItems.length - 1]?.id ?? null)
    : null;

  const roomForClient = {
    id: room.id,
    name: room.name,
    emoji: room.emoji,
    type: room.type as RoomType,
    filters: room.filters as Filter[] | null,
    visibility: room.visibility as RoomVisibility,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
    itemCount: room._count.roomItems,
  };

  const itemsForClient = paginatedRoomItems.map((roomItem) => ({
    roomItemId: roomItem.id,
    addedAt: roomItem.addedAt.toISOString(),
    id: roomItem.item.id,
    kind: roomItem.item.kind,
    processingStatus: roomItem.item.processingStatus,
    fileKey: roomItem.item.fileKey,
    meta: (roomItem.item.meta as Record<string, unknown> | null) ?? null,
    sourceType: roomItem.item.sourceType,
    sourceUrl: roomItem.item.sourceUrl,
    coverFileKey: roomItem.item.coverFileKey,
    createdAt: roomItem.item.createdAt.toISOString(),
    title: roomItem.item.title,
    description: roomItem.item.description,
    tags: roomItem.item.tags,
    notes: null, // Notes are private, not exposed on public room pages
    objects: roomItem.item.imageDetails?.objects ?? [],
    colors: (roomItem.item.imageDetails?.colors as ImageColor[]) ?? [],
    ocrText: roomItem.item.imageDetails?.ocrText ?? null,
    captureDate: roomItem.item.imageDetails?.captureDate?.toISOString() ?? null,
    locations: roomItem.item.locations,
    articleDetails: roomItem.item.articleDetails
      ? {
          ...roomItem.item.articleDetails,
          publishedAt:
            roomItem.item.articleDetails.publishedAt?.toISOString() ?? null,
        }
      : null,
  }));

  return (
    <RoomPageClient
      room={roomForClient}
      initialItems={itemsForClient}
      initialCursor={nextCursor}
      initialHasMore={hasMore}
      isOwner={isOwner}
      isAuthenticated={!!currentUser}
      email={metadata.email}
      firstName={metadata.firstName}
      lastName={metadata.lastName}
      username={currentDbUser?.username ?? metadata.username}
      avatarUrl={currentDbUser?.avatarUrl ?? metadata.avatarUrl}
      availableInvites={availableInvites}
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
