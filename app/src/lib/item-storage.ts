import type { Prisma } from "@prisma/client";
import { documentFileKeys } from "@/lib/documents/create-document-schema";

function positiveNumberField(meta: unknown, key: string): bigint {
  if (meta && typeof meta === "object" && key in meta) {
    const value = (meta as Record<string, unknown>)[key];
    if (typeof value === "number" && value > 0) {
      return BigInt(Math.floor(value));
    }
  }
  return BigInt(0);
}

/**
 * Storage bytes an item's meta accounts for: meta.size (uploads/images) plus
 * meta.coverSize (article/book/product/video covers). The live counters move by
 * this; it misses galleries, favicons and avatars, so the daily reconcile resets
 * them to the true bucket totals (storedBytesByUser).
 */
export function getItemStorageBytes(meta: unknown): bigint {
  return (
    positiveNumberField(meta, "size") + positiveNumberField(meta, "coverSize")
  );
}

/** Non-empty `fileKey` strings from a JSON array of media/image objects. */
function collectFileKeys(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  const keys: string[] = [];
  for (const entry of value) {
    if (entry && typeof entry === "object" && "fileKey" in entry) {
      const key = (entry as Record<string, unknown>).fileKey;
      if (typeof key === "string" && key.length > 0) keys.push(key);
    }
  }
  return keys;
}

/**
 * File keys of the images stored in an ItemProductDetails.images JSON blob.
 * A product stores several images, only the first of which is the cover.
 */
export function extractProductImageKeys(
  images: Prisma.JsonValue | null | undefined,
): string[] {
  return collectFileKeys(images);
}

/**
 * File keys of the images re-hosted for a tweet: each media still (photo or
 * video/gif poster) plus the link-card image. Like products, a tweet stores
 * several images; only the cover is accounted for in `meta.coverSize`, but all
 * of them must be deleted on reanalysis so they don't leak.
 */
export function extractTwitterImageKeys(
  media: Prisma.JsonValue | null | undefined,
  card: Prisma.JsonValue | null | undefined,
): string[] {
  const keys = collectFileKeys(media);
  if (card && typeof card === "object" && "imageFileKey" in card) {
    const key = (card as Record<string, unknown>).imageFileKey;
    if (typeof key === "string" && key.length > 0) keys.push(key);
  }
  return keys;
}

/**
 * File keys of the images re-hosted for an Instagram post: each media still.
 * Only the cover is accounted for in `meta.coverSize`, but all of them must be
 * deleted on reanalysis so they don't leak.
 */
export function extractInstagramImageKeys(
  media: Prisma.JsonValue | null | undefined,
): string[] {
  return collectFileKeys(media);
}

/**
 * Every column holding a key an item's capture/enrichment wrote to the `items`
 * bucket: the item's own file, cover, favicon and source file (a document's
 * original PDF), plus the images re-hosted into product/tweet/Instagram JSON. Re-capturing an item replaces these (see
 * reclaimReplacedStorage), so the old ones must be deleted.
 *
 * This and {@link itemFileKeysSelect} are the single inventory of where an
 * item's files live — delete, reclaim and the image proxy's ownership lookup
 * all derive from it. `item-file-keys.test.ts` fails when a schema column that
 * could hold a key isn't accounted for here.
 */
export const capturedFileKeysSelect = {
  fileKey: true,
  coverFileKey: true,
  faviconFileKey: true,
  sourceFileKey: true,
  productDetails: { select: { images: true } },
  twitterDetails: {
    select: { media: true, card: true, authorAvatarFileKey: true },
  },
  instagramDetails: { select: { media: true } },
} satisfies Prisma.ItemSelect;

/**
 * Every file an item owns: its captured files plus, for a scanned document,
 * each page's displayed and colour-original image. Pages are user-scanned, not
 * re-captured, so they're only in this full set (delete/export), never reclaim.
 */
export const itemFileKeysSelect = {
  ...capturedFileKeysSelect,
  documentPages: { select: { fileKey: true, originalFileKey: true } },
} satisfies Prisma.ItemSelect;

type CapturedFileKeysSource = Prisma.ItemGetPayload<{
  select: typeof capturedFileKeysSelect;
}>;
export type ItemFileKeysSource = Prisma.ItemGetPayload<{
  select: typeof itemFileKeysSelect;
}>;

const isKey = (key: unknown): key is string =>
  typeof key === "string" && key.length > 0;

/** Storage keys an item's capture wrote (see {@link capturedFileKeysSelect}) */
export function collectCapturedFileKeys(
  item: CapturedFileKeysSource,
): string[] {
  const keys = [
    item.fileKey,
    item.coverFileKey,
    item.faviconFileKey,
    item.sourceFileKey,
    ...extractProductImageKeys(item.productDetails?.images),
    ...extractTwitterImageKeys(
      item.twitterDetails?.media,
      item.twitterDetails?.card,
    ),
    item.twitterDetails?.authorAvatarFileKey,
    ...extractInstagramImageKeys(item.instagramDetails?.media),
  ].filter(isKey);
  return [...new Set(keys)];
}

/** Every storage key an item owns, de-duplicated (see {@link itemFileKeysSelect}) */
export function collectItemFileKeys(item: ItemFileKeysSource): string[] {
  return [
    ...new Set([
      ...collectCapturedFileKeys(item),
      ...documentFileKeys(item.documentPages),
    ]),
  ];
}

/**
 * The subset of an item's previous file keys to remove from storage:
 * de-duplicated and excluding any key still in use by the new data (new uploads
 * use fresh UUIDs, so `keepFileKeys` is a safety net rather than a common case).
 */
export function filesToRemove(
  oldFileKeys: string[],
  keepFileKeys: string[],
): string[] {
  const keep = new Set(keepFileKeys);
  return [...new Set(oldFileKeys)].filter((key) => !keep.has(key));
}
