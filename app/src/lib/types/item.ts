/**
 * Shared item types used across the application.
 *
 * This provides a single source of truth for item data structures,
 * using Prisma enums for type safety while supporting JSON serialization.
 */

import type {
  ItemKind,
  ItemLocation as PrismaItemLocation,
  ProcessingStatus,
  RoomType,
  SourceType,
} from "@prisma/client";

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
 * Color information from image analysis.
 *
 * This type supports colors from both:
 * - Google Vision API: returns score (0-1) for dominance
 * - Legacy data: may have percentage instead of score
 */
export type ImageColor = {
  hex: string;
  name: string;
  score?: number;
  percentage?: number;
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
  slug: string;
  type: RoomType;
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
  fileKey: string | null;
  coverFileKey: string | null;
  meta: Record<string, unknown> | null;
  sourceType: SourceType | null;
  sourceUrl: string | null;
  title: string | null;
  description: string | null;
  tags: string[];
  notes: string | null;
  createdAt: string;
  // Flattened from imageDetails
  objects: string[];
  colors: ImageColor[];
  ocrText: string | null;
  captureDate: string | null;
  // Relations
  locations: ItemLocation[];
  articleDetails: ArticleDetails | null;
  // Optional fields (not always present)
  excludeFromPublicRooms?: boolean;
  rooms?: ItemRoom[];
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
