import type { RoomType, RoomVisibility } from "@prisma/client";
import { notFound } from "next/navigation";
import db from "@/lib/db";
import type { RoomFilters } from "@/lib/rooms";
import { createClient } from "@/lib/supabase/server";
import type { ImageColor } from "@/lib/vision";
import { DashboardHeader } from "../../_components/dashboard-header";
import { signOut } from "../../dashboard/actions";
import { RoomDetail } from "./_components/room-detail";

function getString(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const trimmedValue = value.trim();
  if (!trimmedValue) return;
  return trimmedValue;
}

type Props = {
  params: Promise<{ id: string }>;
};

export default async function RoomDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: claims }, { data: userData }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.auth.getUser(),
  ]);

  const user = userData.user;

  if (!user) {
    notFound();
  }

  const claimsRecord = (claims?.claims ?? {}) as Record<string, unknown>;
  const claimsUserMetadata = (claimsRecord.user_metadata ?? {}) as Record<
    string,
    unknown
  >;
  const userMetadata = (userData.user?.user_metadata ?? {}) as Record<
    string,
    unknown
  >;

  const email = getString(claimsRecord.email) ?? userData.user?.email ?? null;
  const firstName =
    getString(userMetadata.first_name) ??
    getString(userMetadata.given_name) ??
    getString(claimsRecord.given_name) ??
    getString(claimsUserMetadata.given_name) ??
    getString(claimsUserMetadata.first_name) ??
    null;
  const lastName =
    getString(userMetadata.last_name) ??
    getString(userMetadata.family_name) ??
    getString(claimsRecord.family_name) ??
    getString(claimsUserMetadata.family_name) ??
    getString(claimsUserMetadata.last_name) ??
    null;
  const avatarUrl: string | null =
    getString(userMetadata.avatar_url) ??
    getString(userMetadata.picture) ??
    getString(claimsRecord.picture) ??
    getString(claimsUserMetadata.picture) ??
    getString(claimsUserMetadata.avatar_url) ??
    null;

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

  // Fetch room items with their associated items
  const roomItems = await db.roomItem.findMany({
    where: { roomId: id },
    take: 100,
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

  const itemsForClient = roomItems.map((roomItem) => ({
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
    <div className="min-h-screen bg-background">
      <DashboardHeader
        email={email}
        firstName={firstName}
        lastName={lastName}
        avatarUrl={avatarUrl}
        signOutAction={signOut}
        showHomeLink
      />

      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <RoomDetail room={roomForClient} initialItems={itemsForClient} />
      </div>
    </div>
  );
}
