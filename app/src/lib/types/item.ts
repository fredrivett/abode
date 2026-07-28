/**
 * Shared item types used across the application.
 *
 * This provides a single source of truth for item data structures,
 * using Prisma enums for type safety while supporting JSON serialization.
 */

import type {
  ItemKind,
  ItemLocation as PrismaItemLocation,
  ProcessingErrorReason,
  ProcessingStatus,
  RoomType,
  SourceType,
} from "@prisma/client";

// Re-export Twitter types for convenience
export type {
  TwitterDetails,
  TwitterMedia,
} from "@/components/twitter/types";

/**
 * Location data for an item, matching the Prisma ItemLocation model
 * but with only the fields needed for UI display.
 */
export type ItemLocation = Pick<
  PrismaItemLocation,
  | "id"
  | "source"
  | "latitude"
  | "longitude"
  | "neighborhood"
  | "city"
  | "region"
  | "country"
  | "countryCode"
  | "formatted"
>;

/**
 * Article-specific details.
 */
export type ArticleDetails = {
  author: string | null;
  domain: string | null;
  publishedAt: string | null;
  readingTime: number | null;
  content: string | null;
};

/**
 * Video-specific details for YouTube/Vimeo embeds.
 */
export type VideoDetails = {
  platform: "youtube" | "vimeo";
  videoId: string;
  channelName: string | null;
  channelUrl: string | null;
  duration: number | null;
  embedUrl: string | null;
  thumbnailUrl: string | null;
};

/**
 * A single product image stored in Supabase.
 */
export type ProductImage = {
  fileKey: string;
  url: string;
  width?: number;
  height?: number;
};

/**
 * Product-specific details for e-commerce URLs.
 */
export type ProductDetails = {
  domain: string | null;
  brand: string | null;
  price: string | null;
  currency: string | null;
  availability: string | null;
  images: ProductImage[] | null;
  coverImageIndex: number | null;
};

/**
 * Book-specific details for book URLs (Goodreads, Google Books, etc.).
 */
export type BookDetails = {
  authors: string[];
  publisher: string | null;
  publishedAt: string | null;
  isbn: string | null;
  pageCount: number | null;
  domain: string | null;
};

/**
 * Note-specific details for user-authored markdown notes.
 */
export type NoteDetails = {
  content: string;
};

/**
 * Color information from image analysis.
 *
 * This type supports colors from both:
 * - Google Vision API: returns score (0-1) for dominance
 * - Legacy data: may have percentage instead of score
 *
 * LAB color space values (l, a, b) are pre-computed from hex
 * for efficient perceptual color matching during search.
 */
export type ImageColor = {
  hex: string;
  name: string;
  score?: number;
  percentage?: number;
  /** LAB lightness (0-100) */
  l?: number;
  /** LAB green-red axis (-128 to +128) */
  a?: number;
  /** LAB blue-yellow axis (-128 to +128) */
  b?: number;
};

/**
 * Match information from search results.
 */
export type MatchReason = {
  field: string | null;
  value?: string;
  snippet?: string;
  proximity?: number;
};

/**
 * Room information for an item.
 * Used to display which rooms an item belongs to.
 */
export type ItemRoom = {
  id: string;
  name: string;
  emoji: string | null;
  slug: string | null;
  type: RoomType;
  username: string | null;
};

/**
 * External link to where an item has been posted.
 * Platform is auto-detected from the URL.
 */
export type ExternalLink = {
  url: string;
  platform: string;
};

/**
 * Core item type with all UI-needed fields.
 *
 * This is the canonical type for items throughout the application.
 * It uses Prisma enums for kind, processingStatus, and sourceType
 * to ensure type safety. These serialize to strings in JSON.
 *
 * Note: When receiving from API responses, the enum fields will be
 * strings that match the enum values (e.g., "image", "processing").
 */
export type Item = {
  id: string;
  kind: ItemKind | null;
  processingStatus: ProcessingStatus;
  processingError?: ProcessingErrorReason | null;
  fileKey: string | null;
  coverFileKey: string | null;
  meta: Record<string, unknown> | null;
  sourceType: SourceType | null;
  sourceUrl: string | null;
  title: string | null;
  description: string | null;
  tags: string[];
  userTags: string[];
  notes: string | null;
  createdAt: string;
  // Flattened from imageDetails
  objects: string[];
  colors: ImageColor[];
  ocrText: string | null;
  captureDate: string | null;
  /** Tiny blurred-placeholder data URL (LQIP), shown while the full image loads */
  blurDataUrl: string | null;
  // Relations
  locations: ItemLocation[];
  articleDetails: ArticleDetails | null;
  twitterDetails: import("@/components/twitter/types").TwitterDetails | null;
  videoDetails: VideoDetails | null;
  productDetails: ProductDetails | null;
  bookDetails: BookDetails | null;
  noteDetails: NoteDetails | null;
  // Optional fields (not always present)
  excludeFromPublicRooms?: boolean;
  // Direct sharing: non-null sharedAt ⟺ viewable via direct link.
  sharedAt?: string | null;
  sharedHighlights?: boolean;
  rooms?: ItemRoom[];
  externalLinks?: ExternalLink[];
};

/**
 * Item with search match information.
 * Used for search results where we need to show why an item matched.
 */
export type SearchItem = Item & {
  match: {
    reasons: MatchReason[];
  };
};
