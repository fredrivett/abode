/**
 * Shared item query utilities for consistent data fetching.
 */

import type { Prisma } from "@prisma/client";
import type {
  BookDetails,
  ExternalLink,
  ImageColor,
  InstagramDetails,
  InstagramMedia,
  NoteDetails,
  ProductDetails,
  ProductImage,
  TwitterDetails,
  TwitterMedia,
  VideoDetails,
} from "@/lib/types/item";

/**
 * The select clause for fetching items - shared between initial load and pagination.
 * This ensures consistent data shape across all item fetching operations.
 */
export const itemSelect = {
  id: true,
  userId: true,
  kind: true,
  processingStatus: true,
  processingError: true,
  fileKey: true,
  meta: true,
  sourceType: true,
  sourceUrl: true,
  coverFileKey: true,
  createdAt: true,
  updatedAt: true,
  title: true,
  description: true,
  tags: true,
  userTags: true,
  notes: true,
  excludeFromPublicRooms: true,
  coverHidden: true,
  sharedAt: true,
  sharedHighlights: true,
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
  bookDetails: {
    select: {
      authors: true,
      publisher: true,
      publishedAt: true,
      isbn: true,
      pageCount: true,
      domain: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      progressValue: true,
      progressUnit: true,
      progressUpdatedAt: true,
      rating: true,
    },
  },
  noteDetails: {
    select: {
      content: true,
    },
  },
  roomItems: {
    select: {
      room: {
        select: {
          id: true,
          name: true,
          emoji: true,
          slug: true,
          type: true,
          user: {
            select: {
              username: true,
            },
          },
        },
      },
    },
  },
  externalLinks: true,
} satisfies Prisma.ItemSelect;

/**
 * Type for a raw item as returned by Prisma with itemSelect
 */
export type RawItem = Prisma.ItemGetPayload<{ select: typeof itemSelect }>;

/**
 * Transform a raw Prisma item to the client format.
 * This flattens nested relations and converts dates to ISO strings.
 */
export function transformItem(item: RawItem) {
  return {
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    meta: (item.meta as Record<string, unknown> | null) ?? null,
    objects: item.imageDetails?.objects ?? [],
    colors: (item.imageDetails?.colors as ImageColor[]) ?? [],
    ocrText: item.imageDetails?.ocrText ?? null,
    captureDate: item.imageDetails?.captureDate?.toISOString() ?? null,
    blurDataUrl: item.imageDetails?.blurDataUrl ?? null,
    excludeFromPublicRooms: item.excludeFromPublicRooms,
    coverHidden: item.coverHidden,
    sharedAt: item.sharedAt?.toISOString() ?? null,
    sharedHighlights: item.sharedHighlights,
    rooms: item.roomItems.map((ri) => ({
      id: ri.room.id,
      name: ri.room.name,
      emoji: ri.room.emoji,
      slug: ri.room.slug,
      type: ri.room.type,
      username: ri.room.user.username,
    })),
    externalLinks: (item.externalLinks as ExternalLink[] | null) ?? [],
    imageDetails: undefined,
    roomItems: undefined,
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
    bookDetails: item.bookDetails ? mapBookDetails(item.bookDetails) : null,
    noteDetails: item.noteDetails
      ? ({ content: item.noteDetails.content } satisfies NoteDetails)
      : null,
  };
}

/**
 * Map a raw book-details row to the client BookDetails DTO (dates → ISO
 * strings). Shared by transformItem and the item PATCH handler so the reading
 * fields stay in sync in one place.
 */
export function mapBookDetails(
  book: NonNullable<RawItem["bookDetails"]>,
): BookDetails {
  return {
    authors: book.authors,
    publisher: book.publisher,
    publishedAt: book.publishedAt?.toISOString() ?? null,
    isbn: book.isbn,
    pageCount: book.pageCount,
    domain: book.domain,
    status: book.status,
    startedAt: book.startedAt?.toISOString() ?? null,
    finishedAt: book.finishedAt?.toISOString() ?? null,
    progressValue: book.progressValue,
    progressUnit: book.progressUnit,
    progressUpdatedAt: book.progressUpdatedAt?.toISOString() ?? null,
    rating: book.rating,
  };
}
