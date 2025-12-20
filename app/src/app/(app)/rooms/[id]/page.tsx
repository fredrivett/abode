import type { RoomType, RoomVisibility } from "@prisma/client";
import { notFound } from "next/navigation";
import db from "@/lib/db";
import type { RoomFilters } from "@/lib/rooms";
import { createClient } from "@/lib/supabase/server";
import { getUserWithMetadata } from "@/lib/supabase/user-metadata";
import type { ImageColor } from "@/lib/vision";
import { DashboardHeader } from "../../_components/dashboard-header";
import { RoomDetail } from "./_components/room-detail";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function RoomDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { user } = await getUserWithMetadata(supabase);

  if (!user) {
    notFound();
  }

  // Fetch room with item count
  const room = await db.room.findUnique({
    where: {
      id,
      userId: user.id,
    },
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
  });

  if (!room) {
    notFound();
  }

  const PAGE_SIZE = 100;

  // Fetch room items with their associated items
  const roomItems = await db.roomItem.findMany({
    where: { roomId: id },
    take: PAGE_SIZE + 1, // Fetch one extra to determine if there are more
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

  // Check if there are more items
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
    type: room.type as RoomType,
    filters: room.filters as RoomFilters | null,
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
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <DashboardHeader />

      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <RoomDetail
          room={roomForClient}
          initialItems={itemsForClient}
          initialCursor={nextCursor}
          initialHasMore={hasMore}
        />
      </div>
    </div>
  );
}
