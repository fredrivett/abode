import type { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { cache } from "react";
import db from "@/lib/db";
import {
  canViewItem,
  canViewItemHighlights,
  itemAccessSelect,
} from "@/lib/items/access";
import type {
  InstagramDetails,
  InstagramMedia,
  ProductDetails,
  ProductImage,
  TwitterDetails,
  TwitterMedia,
  VideoDetails,
} from "@/lib/types/item";
import { getAuthenticatedUser } from "@/lib/user";
import type { ImageColor } from "@/lib/vision";
import { ItemDetailView } from "./_components/item-detail-view";

type Props = {
  params: Promise<{ username: string; id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// Parse and validate the username from the route param.
// Returns the username without the @ prefix, or null if invalid (missing @).
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

// Full client-shape select PLUS access-control fields and sharing/highlight
// metadata. Mirrors the room page item select so the existing rendering
// components can be reused.
const itemDetailSelect = {
  id: true,
  kind: true,
  processingStatus: true,
  fileKey: true,
  meta: true,
  sourceType: true,
  sourceUrl: true,
  coverFileKey: true,
  faviconFileKey: true,
  createdAt: true,
  title: true,
  description: true,
  tags: true,
  userTags: true,
  sharedHighlights: true,
  // Access-control fields (userId, sharedAt, excludeFromPublicRooms, roomItems)
  ...itemAccessSelect,
  // Room context for the optional ?room= breadcrumb. We override the
  // itemAccessSelect.roomItems with a richer select that also includes
  // presentation fields.
  roomItems: {
    select: {
      room: {
        select: {
          visibility: true,
          slug: true,
          name: true,
          emoji: true,
        },
      },
    },
  },
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
} satisfies Prisma.ItemSelect;

type ItemDetailPayload = Prisma.ItemGetPayload<{
  select: typeof itemDetailSelect;
}>;

const getItem = cache(async (id: string): Promise<ItemDetailPayload | null> => {
  return db.item.findUnique({
    where: { id },
    select: itemDetailSelect,
  });
});

// Highlights for shared article views. Fetched server-side so signed-out
// viewers (who can't call the owner-only highlights API) still see them.
const getHighlights = cache(async (itemId: string, ownerId: string) => {
  return db.articleHighlight.findMany({
    where: { itemId, userId: ownerId },
    orderBy: { startOffset: "asc" },
    select: {
      id: true,
      itemId: true,
      startOffset: true,
      endOffset: true,
      text: true,
      note: true,
      createdAt: true,
      updatedAt: true,
    },
  });
});

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function generateMetadata({ params }: Props) {
  const { username: rawUsername, id } = await params;
  const username = parseUsername(rawUsername);

  if (!username) {
    return { title: "Not found" };
  }

  const user = await getUser(username);
  if (!user) {
    return { title: "Not found" };
  }

  const item = await getItem(id);
  // Don't leak existence of items the current request can't view.
  if (!item || item.userId !== user.id) {
    return { title: "Not found" };
  }

  const currentUser = await getAuthenticatedUser();
  if (!canViewItem(item, currentUser?.id ?? null)) {
    return { title: "Not found" };
  }

  return {
    title: `${item.title ?? "Item"} | @${user.username} | abode`,
    description: item.description ?? undefined,
  };
}

export default async function ItemPage({ params, searchParams }: Props) {
  const { username: rawUsername, id } = await params;
  const resolvedSearchParams = await searchParams;
  const username = parseUsername(rawUsername);

  // Only match URLs with the @ prefix (e.g. /@fred/items/123).
  if (!username) {
    notFound();
  }

  const user = await getUser(username);
  if (!user) {
    notFound();
  }

  const item = await getItem(id);
  if (!item) {
    notFound();
  }

  // The item must belong to the user named in the URL.
  if (item.userId !== user.id) {
    notFound();
  }

  const currentUser = await getAuthenticatedUser();
  const viewerId = currentUser?.id ?? null;

  // Access gate — use 404 (never 403) so we don't confirm existence to
  // non-viewers.
  if (!canViewItem(item, viewerId)) {
    notFound();
  }

  const isOwner = viewerId !== null && viewerId === item.userId;

  // Presentation-only ?room= context. Validate that the room exists, is
  // public, and actually contains this item. Never used in the access
  // decision above.
  const roomSlug = firstParam(resolvedSearchParams.room);
  const roomContext =
    roomSlug !== null
      ? (() => {
          const match = item.roomItems.find(
            (ri) =>
              ri.room.visibility === "public" &&
              ri.room.slug !== null &&
              ri.room.slug.toLowerCase() === roomSlug.toLowerCase(),
          );
          if (!match || match.room.slug === null) return null;
          return {
            slug: match.room.slug,
            name: match.room.name,
            emoji: match.room.emoji,
          };
        })()
      : null;

  // ?highlight= passes through to the client so the article can scroll to /
  // flash the highlight.
  const highlightId = firstParam(resolvedSearchParams.highlight);

  // Highlights only when allowed (owner or sharedHighlights) and only for
  // articles.
  const showHighlights =
    item.kind === "article" && canViewItemHighlights(item, viewerId);
  const highlights = showHighlights
    ? (await getHighlights(item.id, item.userId)).map((h) => ({
        id: h.id,
        startOffset: h.startOffset,
        endOffset: h.endOffset,
        text: h.text,
        note: h.note,
        createdAt: h.createdAt.toISOString(),
      }))
    : [];

  // Convert the DB item into the client shape. NEVER expose notes.
  const itemForClient = {
    id: item.id,
    kind: item.kind,
    processingStatus: item.processingStatus,
    fileKey: item.fileKey,
    meta: (item.meta as Record<string, unknown> | null) ?? null,
    sourceType: item.sourceType,
    sourceUrl: item.sourceUrl,
    coverFileKey: item.coverFileKey,
    faviconFileKey: item.faviconFileKey,
    createdAt: item.createdAt.toISOString(),
    title: item.title,
    description: item.description,
    tags: item.tags,
    userTags: item.userTags,
    notes: null, // Notes are private, never exposed on public item pages
    objects: item.imageDetails?.objects ?? [],
    colors: (item.imageDetails?.colors as ImageColor[]) ?? [],
    ocrText: item.imageDetails?.ocrText ?? null,
    captureDate: item.imageDetails?.captureDate?.toISOString() ?? null,
    locations: item.locations,
    articleDetails: item.articleDetails
      ? {
          ...item.articleDetails,
          publishedAt: item.articleDetails.publishedAt?.toISOString() ?? null,
        }
      : null,
    twitterDetails: item.twitterDetails
      ? ({
          tweetId: item.twitterDetails.tweetId,
          authorName: item.twitterDetails.authorName,
          authorUsername: item.twitterDetails.authorUsername,
          authorAvatarUrl: item.twitterDetails.authorAvatarUrl,
          text: item.twitterDetails.text,
          postedAt: item.twitterDetails.postedAt?.toISOString() ?? null,
          media: item.twitterDetails.media as TwitterMedia[] | null,
          quotedTweetId: item.twitterDetails.quotedTweetId,
          card: item.twitterDetails.card as TwitterDetails["card"],
          coverMediaIndex: item.twitterDetails.coverMediaIndex,
        } satisfies TwitterDetails)
      : null,
    instagramDetails: item.instagramDetails
      ? ({
          postId: item.instagramDetails.postId,
          mediaType: item.instagramDetails
            .mediaType as InstagramDetails["mediaType"],
          authorName: item.instagramDetails.authorName,
          authorUsername: item.instagramDetails.authorUsername,
          caption: item.instagramDetails.caption,
          postedAt: item.instagramDetails.postedAt?.toISOString() ?? null,
          media: item.instagramDetails.media as InstagramMedia[] | null,
          likeCount: item.instagramDetails.likeCount,
          commentCount: item.instagramDetails.commentCount,
          coverMediaIndex: item.instagramDetails.coverMediaIndex,
        } satisfies InstagramDetails)
      : null,
    videoDetails: item.videoDetails
      ? ({
          platform: item.videoDetails.platform as VideoDetails["platform"],
          videoId: item.videoDetails.videoId,
          channelName: item.videoDetails.channelName,
          channelUrl: item.videoDetails.channelUrl,
          duration: item.videoDetails.duration,
          embedUrl: item.videoDetails.embedUrl,
          thumbnailUrl: item.videoDetails.thumbnailUrl,
        } satisfies VideoDetails)
      : null,
    productDetails: item.productDetails
      ? ({
          domain: item.productDetails.domain,
          brand: item.productDetails.brand,
          price: item.productDetails.price,
          currency: item.productDetails.currency,
          availability: item.productDetails.availability,
          images: item.productDetails.images as ProductImage[] | null,
          coverImageIndex: item.productDetails.coverImageIndex,
        } satisfies ProductDetails)
      : null,
  };

  return (
    <ItemDetailView
      item={itemForClient}
      owner={{
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      }}
      isOwner={isOwner}
      highlights={highlights}
      scrollToHighlightId={highlightId}
      roomContext={roomContext}
    />
  );
}
