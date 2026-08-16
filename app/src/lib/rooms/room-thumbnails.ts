import type { Prisma } from "@prisma/client";
import { getProxyImageUrl } from "@/lib/image-url";

/** A single item preview shown on a room card: proxy URL + optional LQIP */
export type RoomThumbnail = { url: string; blurDataUrl: string | null };

/** How many item thumbnails a room card previews */
export const ROOM_THUMBNAIL_LIMIT = 4;

/**
 * Prisma `where` for room items that can contribute a public thumbnail.
 *
 * Excludes items the owner has held back from public rooms or whose cover is
 * hidden (the image proxy would 403 the former), and requires a cover image to
 * derive a URL from. `coverFileKey` is the unified cover for every non-image
 * kind (video/tweet/instagram/product/article/book all populate it); images
 * fall back to `fileKey`.
 */
export const roomThumbnailItemWhere = {
  excludeFromPublicRooms: false,
  coverHidden: false,
  OR: [{ fileKey: { not: null } }, { coverFileKey: { not: null } }],
} satisfies Prisma.ItemWhereInput;

/** The item fields needed to build a thumbnail — spread into a room-items select */
export const roomThumbnailItemSelect = {
  fileKey: true,
  coverFileKey: true,
  imageDetails: { select: { blurDataUrl: true } },
} satisfies Prisma.ItemSelect;

type ThumbnailItem = {
  fileKey: string | null;
  coverFileKey: string | null;
  imageDetails: { blurDataUrl: string | null } | null;
};

/** Build a thumbnail for an item, or null when it has no usable cover image */
export function deriveRoomThumbnail(item: ThumbnailItem): RoomThumbnail | null {
  const fileKey = item.coverFileKey ?? item.fileKey;
  if (!fileKey) return null;
  return {
    url: getProxyImageUrl(fileKey, "thumb"),
    blurDataUrl: item.imageDetails?.blurDataUrl ?? null,
  };
}

/** Map room items to thumbnails, dropping any without a cover image */
export function deriveRoomThumbnails(items: ThumbnailItem[]): RoomThumbnail[] {
  return items
    .map(deriveRoomThumbnail)
    .filter((thumb): thumb is RoomThumbnail => thumb !== null);
}
