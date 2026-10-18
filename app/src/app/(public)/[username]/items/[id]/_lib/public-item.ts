/**
 * Data loading shared by the public item page and the public highlight page
 * (which renders the same item, focused on one highlight).
 */
import type { Prisma } from "@prisma/client";
import { cache } from "react";
import db from "@/lib/db";
import { shareInvitesOpen } from "@/lib/invites/share-invite";
import {
  canViewItem,
  canViewItemHighlights,
  itemAccessSelect,
} from "@/lib/items/access";
import {
  publicLocationSelect,
  toPublicLocation,
} from "@/lib/items/public-location";
import {
  EMPTY_ARTICLE_READ_STATE,
  mapPublicBookDetails,
  publicBookDetailsSelect,
} from "@/lib/items/query";
import { isCanonicalUuid } from "@/lib/pagination";
import {
  mapTwitterDetails,
  twitterDetailsSelect,
} from "@/lib/twitter/map-twitter-details";
import type {
  InstagramDetails,
  InstagramMedia,
  ProductDetails,
  ProductImage,
  VideoDetails,
} from "@/lib/types/item";
import { getAuthenticatedUser } from "@/lib/user";
import type { ImageColor } from "@/lib/vision";

// Parse and validate the username from the route param.
// Returns the username without the @ prefix, or null if invalid (missing @).
export function parseUsername(rawUsername: string): string | null {
  // Next.js passes URL-encoded params, so %40 needs to be decoded to @
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawUsername);
  } catch {
    // Malformed percent-escape (e.g. a bare "%") — 404, not 500
    return null;
  }
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
      allowShareInvites: true,
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
  locations: { select: publicLocationSelect },
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
  twitterDetails: { select: twitterDetailsSelect },
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

const highlightSelect = {
  id: true,
  startOffset: true,
  endOffset: true,
  text: true,
  createdAt: true,
} satisfies Prisma.ArticleHighlightSelect;

type HighlightRow = Prisma.ArticleHighlightGetPayload<{
  select: typeof highlightSelect;
}>;

// A highlight's note is the owner's private annotation; public views share the
// quote, never the note
function toClientHighlight(highlight: HighlightRow) {
  return {
    ...highlight,
    note: null,
    createdAt: highlight.createdAt.toISOString(),
  };
}

export type PublicHighlight = ReturnType<typeof toClientHighlight>;

/**
 * The owner's highlights to show on a shared article view — only when allowed
 * (owner, or the item opts in via sharedHighlights). Fetched server-side so
 * signed-out viewers (who can't call the owner-only highlights API) see them.
 */
export async function getVisibleHighlights({
  item,
  viewerId,
}: {
  item: ItemDetailPayload;
  viewerId: string | null;
}): Promise<PublicHighlight[]> {
  if (item.kind !== "article" || !canViewItemHighlights(item, viewerId)) {
    return [];
  }
  const rows = await db.articleHighlight.findMany({
    where: { itemId: item.id, userId: item.userId },
    orderBy: { startOffset: "asc" },
    select: highlightSelect,
  });
  return rows.map(toClientHighlight);
}

// Keyed on the id alone so React's per-request cache dedupes the lookup
// between generateMetadata and the page
const getHighlightById = cache(async (highlightId: string) =>
  db.articleHighlight.findUnique({
    where: { id: highlightId },
    select: { ...highlightSelect, itemId: true, userId: true },
  }),
);

/**
 * One of the owner's highlights on this article, by id. Its link is the share
 * grant for that highlight, so unlike the full list it doesn't need the item's
 * sharedHighlights opt-in (the article itself must still be viewable).
 */
export async function getSharedHighlight({
  item,
  highlightId,
}: {
  item: ItemDetailPayload;
  highlightId: string;
}): Promise<PublicHighlight | null> {
  if (item.kind !== "article" || !isCanonicalUuid(highlightId)) return null;
  const row = await getHighlightById(highlightId);
  if (!row || row.itemId !== item.id || row.userId !== item.userId) {
    return null;
  }
  const { itemId: _itemId, userId: _userId, ...highlight } = row;
  return toClientHighlight(highlight);
}

/** Convert the DB item into the client shape. NEVER exposes notes. */
export function toClientItem(item: ItemDetailPayload) {
  return {
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
    locations: item.locations.map(toPublicLocation),
    articleDetails: item.articleDetails
      ? {
          ...item.articleDetails,
          publishedAt: item.articleDetails.publishedAt?.toISOString() ?? null,
          // Read state stays private — never exposed on public pages.
          ...EMPTY_ARTICLE_READ_STATE,
        }
      : null,
    twitterDetails: item.twitterDetails
      ? mapTwitterDetails(item.twitterDetails)
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
    bookDetails: item.bookDetails
      ? mapPublicBookDetails(item.bookDetails)
      : null,
  };
}

export type PublicItem = {
  user: NonNullable<Awaited<ReturnType<typeof getUser>>>;
  item: ItemDetailPayload;
  viewerId: string | null;
  isOwner: boolean;
};

/**
 * Resolve a public item route to its owner and item, or null when the URL is
 * malformed, the item isn't the named user's, or the viewer can't see it.
 * Callers 404 on null (never 403) so existence isn't confirmed to non-viewers.
 */
export async function loadPublicItem({
  rawUsername,
  id,
}: {
  rawUsername: string;
  id: string;
}): Promise<PublicItem | null> {
  // Only match URLs with the @ prefix (e.g. /@fred/items/123).
  const username = parseUsername(rawUsername);
  if (!username || !isCanonicalUuid(id)) return null;

  const user = await getUser(username);
  if (!user) return null;

  // The item must belong to the user named in the URL.
  const item = await getItem(id);
  if (!item || item.userId !== user.id) return null;

  const currentUser = await getAuthenticatedUser();
  const viewerId = currentUser?.id ?? null;
  if (!canViewItem(item, viewerId)) return null;

  return {
    user,
    item,
    viewerId,
    isOwner: viewerId !== null && viewerId === item.userId,
  };
}

export type SaveCtaState = { isSignedIn: boolean; invitesOpen: boolean };

/**
 * How the "Save to your abode" CTA should appear for this viewer, or null for
 * the owner (it's already theirs). Invite availability only matters to
 * signed-out readers, so it's only looked up for them.
 */
export async function getSaveCtaState({
  user,
  viewerId,
  isOwner,
}: Pick<
  PublicItem,
  "user" | "viewerId" | "isOwner"
>): Promise<SaveCtaState | null> {
  if (isOwner) return null;
  if (viewerId) return { isSignedIn: true, invitesOpen: false };
  return { isSignedIn: false, invitesOpen: await shareInvitesOpen(user) };
}
