import type { Prisma } from "@prisma/client";
import {
  EMPTY_ARTICLE_READ_STATE,
  mapPublicBookDetails,
  publicBookDetailsSelect,
} from "@/lib/items/query";
import {
  mapTwitterDetails,
  twitterDetailsSelect,
} from "@/lib/twitter/map-twitter-details";
import type {
  InstagramDetails,
  InstagramMedia,
  NoteDetails,
  ProductDetails,
  ProductImage,
  VideoDetails,
} from "@/lib/types/item";
import type { RoomItem } from "@/lib/types/room";
import type { ImageColor } from "@/lib/vision";

/**
 * What a room grid needs of each room item: the item plus every kind's
 * details (cards render from them, and `getCardFrame` sizes them from them).
 * Shared by the room page and its "Load more" API so both return identical
 * items — they'd drifted, leaving paginated cards without their details.
 */
export const roomItemSelect = {
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
      // Presentation: a cover hidden on the grid card stays hidden in rooms
      coverHidden: true,
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
      noteDetails: {
        select: {
          content: true,
        },
      },
    },
  },
} satisfies Prisma.RoomItemSelect;

export type RoomItemRow = Prisma.RoomItemGetPayload<{
  select: typeof roomItemSelect;
}>;

/** Serialize a room item row for the client (dates as ISO strings). */
export function toClientRoomItem(roomItem: RoomItemRow): RoomItem {
  return {
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
    coverHidden: roomItem.item.coverHidden,
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
          // Read state stays private — never exposed on public pages.
          ...EMPTY_ARTICLE_READ_STATE,
        }
      : null,
    twitterDetails: roomItem.item.twitterDetails
      ? mapTwitterDetails(roomItem.item.twitterDetails)
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
  };
}
