import type { RoomType, RoomVisibility } from "@prisma/client";
import { notFound } from "next/navigation";
import { cache } from "react";
import { signOut } from "@/lib/actions/auth";
import db from "@/lib/db";
import {
  mapPublicBookDetails,
  publicBookDetailsSelect,
} from "@/lib/items/query";
import type { Filter } from "@/lib/search/types";
import type {
  InstagramDetails,
  InstagramMedia,
  NoteDetails,
  ProductDetails,
  ProductImage,
  TwitterDetails,
  TwitterMedia,
  VideoDetails,
} from "@/lib/types/item";
import { getAuthenticatedUser } from "@/lib/user";
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
          captureSource: true,
          coverFileKey: true,
          faviconFileKey: true,
          createdAt: true,
          title: true,
          description: true,
          tags: true,
          userTags: true,
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
              blurDataUrl: true,
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
          twitterDetails: {
            select: {
              tweetId: true,
              authorName: true,
              authorUsername: true,
              authorAvatarUrl: true,
              text: true,
              postedAt: true,
              media: true,
              quotedTweetId: true,
              card: true,
              coverMediaIndex: true,
            },
          },
          instagramDetails: {
            select: {
              postId: true,
              mediaType: true,
              authorName: true,
              authorUsername: true,
              caption: true,
              postedAt: true,
              media: true,
              likeCount: true,
              commentCount: true,
              coverMediaIndex: true,
            },
          },
          videoDetails: {
            select: {
              platform: true,
              videoId: true,
              channelName: true,
              channelUrl: true,
              duration: true,
              embedUrl: true,
              thumbnailUrl: true,
            },
          },
          productDetails: {
            select: {
              domain: true,
              brand: true,
              price: true,
              currency: true,
              availability: true,
              images: true,
              coverImageIndex: true,
            },
          },
          bookDetails: { select: publicBookDetailsSelect },
          noteDetails: {
            select: {
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
    slug: room.slug,
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
    captureSource: roomItem.item.captureSource,
    coverFileKey: roomItem.item.coverFileKey,
    faviconFileKey: roomItem.item.faviconFileKey,
    createdAt: roomItem.item.createdAt.toISOString(),
    title: roomItem.item.title,
    description: roomItem.item.description,
    tags: roomItem.item.tags,
    userTags: roomItem.item.userTags,
    notes: null, // Notes are private, not exposed on public room pages
    objects: roomItem.item.imageDetails?.objects ?? [],
    colors: (roomItem.item.imageDetails?.colors as ImageColor[]) ?? [],
    ocrText: roomItem.item.imageDetails?.ocrText ?? null,
    captureDate: roomItem.item.imageDetails?.captureDate?.toISOString() ?? null,
    blurDataUrl: roomItem.item.imageDetails?.blurDataUrl ?? null,
    locations: roomItem.item.locations,
    articleDetails: roomItem.item.articleDetails
      ? {
          ...roomItem.item.articleDetails,
          publishedAt:
            roomItem.item.articleDetails.publishedAt?.toISOString() ?? null,
        }
      : null,
    twitterDetails: roomItem.item.twitterDetails
      ? ({
          tweetId: roomItem.item.twitterDetails.tweetId,
          authorName: roomItem.item.twitterDetails.authorName,
          authorUsername: roomItem.item.twitterDetails.authorUsername,
          authorAvatarUrl: roomItem.item.twitterDetails.authorAvatarUrl,
          text: roomItem.item.twitterDetails.text,
          postedAt:
            roomItem.item.twitterDetails.postedAt?.toISOString() ?? null,
          media: roomItem.item.twitterDetails.media as TwitterMedia[] | null,
          quotedTweetId: roomItem.item.twitterDetails.quotedTweetId,
          card: roomItem.item.twitterDetails.card as TwitterDetails["card"],
          coverMediaIndex: roomItem.item.twitterDetails.coverMediaIndex,
        } satisfies TwitterDetails)
      : null,
    instagramDetails: roomItem.item.instagramDetails
      ? ({
          postId: roomItem.item.instagramDetails.postId,
          mediaType: roomItem.item.instagramDetails
            .mediaType as InstagramDetails["mediaType"],
          authorName: roomItem.item.instagramDetails.authorName,
          authorUsername: roomItem.item.instagramDetails.authorUsername,
          caption: roomItem.item.instagramDetails.caption,
          postedAt:
            roomItem.item.instagramDetails.postedAt?.toISOString() ?? null,
          media: roomItem.item.instagramDetails.media as
            | InstagramMedia[]
            | null,
          likeCount: roomItem.item.instagramDetails.likeCount,
          commentCount: roomItem.item.instagramDetails.commentCount,
          coverMediaIndex: roomItem.item.instagramDetails.coverMediaIndex,
        } satisfies InstagramDetails)
      : null,
    videoDetails: roomItem.item.videoDetails
      ? ({
          platform: roomItem.item.videoDetails
            .platform as VideoDetails["platform"],
          videoId: roomItem.item.videoDetails.videoId,
          channelName: roomItem.item.videoDetails.channelName,
          channelUrl: roomItem.item.videoDetails.channelUrl,
          duration: roomItem.item.videoDetails.duration,
          embedUrl: roomItem.item.videoDetails.embedUrl,
          thumbnailUrl: roomItem.item.videoDetails.thumbnailUrl,
        } satisfies VideoDetails)
      : null,
    productDetails: roomItem.item.productDetails
      ? ({
          domain: roomItem.item.productDetails.domain,
          brand: roomItem.item.productDetails.brand,
          price: roomItem.item.productDetails.price,
          currency: roomItem.item.productDetails.currency,
          availability: roomItem.item.productDetails.availability,
          images: roomItem.item.productDetails.images as ProductImage[] | null,
          coverImageIndex: roomItem.item.productDetails.coverImageIndex,
        } satisfies ProductDetails)
      : null,
    bookDetails: roomItem.item.bookDetails
      ? mapPublicBookDetails(roomItem.item.bookDetails)
      : null,
    noteDetails: roomItem.item.noteDetails
      ? ({ content: roomItem.item.noteDetails.content } satisfies NoteDetails)
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
