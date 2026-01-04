/**
 * Shared item query utilities for consistent data fetching.
 */

import type { Prisma } from "@prisma/client";
import type { ExternalLink, ImageColor } from "@/lib/types/item";

/**
 * The select clause for fetching items - shared between initial load and pagination.
 * This ensures consistent data shape across all item fetching operations.
 */
export const itemSelect = {
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
  userTags: true,
  notes: true,
  excludeFromPublicRooms: true,
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
  roomItems: {
    select: {
      room: {
        select: {
          id: true,
          name: true,
          emoji: true,
          slug: true,
          type: true,
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
    meta: (item.meta as Record<string, unknown> | null) ?? null,
    objects: item.imageDetails?.objects ?? [],
    colors: (item.imageDetails?.colors as ImageColor[]) ?? [],
    ocrText: item.imageDetails?.ocrText ?? null,
    captureDate: item.imageDetails?.captureDate?.toISOString() ?? null,
    excludeFromPublicRooms: item.excludeFromPublicRooms,
    rooms: item.roomItems.map((ri) => ri.room),
    externalLinks: (item.externalLinks as ExternalLink[] | null) ?? [],
    imageDetails: undefined,
    roomItems: undefined,
    articleDetails: item.articleDetails
      ? {
          ...item.articleDetails,
          publishedAt: item.articleDetails.publishedAt?.toISOString() ?? null,
        }
      : null,
  };
}
