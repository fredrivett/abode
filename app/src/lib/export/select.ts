import type { Prisma } from "@prisma/client";

/**
 * What a data export reads, as explicit Prisma selects. Every exported column
 * is named here, and `export-coverage.test.ts` fails when a column is added to
 * an exported model without being either selected here or excluded (with a
 * reason) there — so the export can't silently fall behind the schema, and
 * internal columns can't silently leak into it.
 *
 * Storage keys (fileKey etc.) are read so the item's files can be copied into
 * the archive, but never written out: the export references each file by its
 * path inside the archive (`files/<itemId>/<name>`) instead.
 */

export const exportProfileSelect = {
  email: true,
  username: true,
  previousUsernames: true,
  firstName: true,
  lastName: true,
  website: true,
  bio: true,
  avatarUrl: true,
  avatarSource: true,
  memberNumber: true,
  createdAt: true,
  showInvitedBy: true,
  showInvited: true,
  allowSearchIndexing: true,
  // Auto book shelves the user removed, so an import doesn't bring them back
  dismissedAutoRooms: true,
} satisfies Prisma.UserSelect;

export const exportNoteDraftSelect = {
  content: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NoteDraftSelect;

export const exportRoomSelect = {
  id: true,
  name: true,
  slug: true,
  emoji: true,
  type: true,
  filters: true,
  visibility: true,
  // Set on auto-generated book shelves (Want to read / Reading / Read)
  autoKind: true,
  createdAt: true,
  updatedAt: true,
  roomItems: {
    select: { itemId: true, addedAt: true },
    orderBy: { addedAt: "asc" },
  },
} satisfies Prisma.RoomSelect;

export const exportItemSelect = {
  id: true,
  kind: true,
  title: true,
  titleEditedByUser: true,
  description: true,
  sourceType: true,
  sourceUrl: true,
  captureSource: true,
  meta: true,
  tags: true,
  userTags: true,
  notes: true,
  addedAt: true,
  createdAt: true,
  updatedAt: true,
  excludeFromPublicRooms: true,
  coverHidden: true,
  externalLinks: true,
  sharedAt: true,
  sharedHighlights: true,
  fileKey: true,
  coverFileKey: true,
  faviconFileKey: true,
  sourceFileKey: true,
  articleDetails: {
    select: {
      author: true,
      domain: true,
      publishedAt: true,
      readingTime: true,
      content: true,
      readAt: true,
      scrollProgress: true,
      progressUpdatedAt: true,
    },
  },
  imageDetails: {
    select: { objects: true, colors: true, ocrText: true, captureDate: true },
  },
  twitterDetails: {
    select: {
      tweetId: true,
      authorName: true,
      authorUsername: true,
      authorAvatarUrl: true,
      authorAvatarFileKey: true,
      text: true,
      isTruncated: true,
      postedAt: true,
      media: true,
      quotedTweetId: true,
      quotedTweet: true,
      card: true,
      poll: true,
      coverMediaIndex: true,
      inReplyToTweetId: true,
      inReplyToAuthorUsername: true,
      inReplyToAuthorName: true,
      inReplyToText: true,
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
      startedAtPrecision: true,
      finishedAt: true,
      finishedAtPrecision: true,
      progressValue: true,
      progressUnit: true,
      progressUpdatedAt: true,
      rating: true,
      review: true,
    },
  },
  noteDetails: { select: { content: true } },
  documentPages: {
    select: {
      position: true,
      filter: true,
      width: true,
      height: true,
      ocrText: true,
      fileKey: true,
      originalFileKey: true,
    },
    orderBy: { position: "asc" },
  },
  locations: {
    select: {
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
  highlights: {
    select: {
      id: true,
      startOffset: true,
      endOffset: true,
      text: true,
      note: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { startOffset: "asc" },
  },
} satisfies Prisma.ItemSelect;

export type ExportProfileRow = Prisma.UserGetPayload<{
  select: typeof exportProfileSelect;
}>;
export type ExportRoomRow = Prisma.RoomGetPayload<{
  select: typeof exportRoomSelect;
}>;
export type ExportItemRow = Prisma.ItemGetPayload<{
  select: typeof exportItemSelect;
}>;
export type ExportNoteDraftRow = Prisma.NoteDraftGetPayload<{
  select: typeof exportNoteDraftSelect;
}>;

/** The top-level select behind each exported model, for the coverage test */
export const EXPORT_ROOT_SELECTS = {
  User: exportProfileSelect,
  NoteDraft: exportNoteDraftSelect,
  Room: exportRoomSelect,
  Item: exportItemSelect,
} as const;
