import type { Prisma } from "@prisma/client";
import { getProxyImageUrl } from "@/lib/image-url";
import { resolveSimilarImageCover } from "@/lib/search/similar-image-cover";

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

/**
 * The item fields needed to build a thumbnail — spread into a room-items select.
 *
 * `mediaAnalyses` carries the authoritative per-file LQIP for multi-image kinds
 * (tweets, carousels), so the blur follows a swapped cover before the 1-per-item
 * `imageDetails` mirror catches up — see {@link resolveSimilarImageCover}.
 */
export const roomThumbnailItemSelect = {
  fileKey: true,
  coverFileKey: true,
  imageDetails: { select: { blurDataUrl: true } },
  mediaAnalyses: { select: { fileKey: true, blurDataUrl: true } },
} satisfies Prisma.ItemSelect;

type ThumbnailItem = {
  fileKey: string | null;
  coverFileKey: string | null;
  imageDetails: { blurDataUrl: string | null } | null;
  mediaAnalyses: Array<{ fileKey: string; blurDataUrl: string | null }>;
};

/** Build a thumbnail for an item, or null when it has no usable cover image */
export function deriveRoomThumbnail(item: ThumbnailItem): RoomThumbnail | null {
  const { fileKey, blurDataUrl } = resolveSimilarImageCover({
    fileKey: item.fileKey,
    coverFileKey: item.coverFileKey,
    imageDetailsBlurDataUrl: item.imageDetails?.blurDataUrl,
    mediaAnalyses: item.mediaAnalyses,
  });
  if (!fileKey) return null;
  return { url: getProxyImageUrl(fileKey, "thumb"), blurDataUrl };
}

/** Map room items to thumbnails, dropping any without a cover image */
export function deriveRoomThumbnails(items: ThumbnailItem[]): RoomThumbnail[] {
  return items
    .map(deriveRoomThumbnail)
    .filter((thumb): thumb is RoomThumbnail => thumb !== null);
}
