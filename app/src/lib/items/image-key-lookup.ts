import type { Prisma } from "@prisma/client";
import db from "@/lib/db";
import { itemAccessSelect } from "./access";

/**
 * Where-clause matching the item that owns an image `fileKey`, for the image
 * proxy to authorize a request. Re-hostable keys live in several places: the
 * item's own `fileKey`/`coverFileKey`/`faviconFileKey`, and inside JSON blobs — the product
 * gallery (`ItemProductDetails.images`), a tweet's media stills
 * (`ItemTwitterDetails.media[].fileKey`), a tweet's link-card image
 * (`ItemTwitterDetails.card.imageFileKey`), a tweet's re-hosted author avatar
 * (`ItemTwitterDetails.authorAvatarFileKey`), and an Instagram post's media
 * (`ItemInstagramDetails.media[].fileKey`), plus a scanned document's pages
 * (`item_document_pages`, displayed and colour original). JSONB containment
 * matches the JSON ones without scanning every row.
 *
 * Must cover every location in `itemFileKeysSelect` (@/lib/item-storage), or
 * the proxy 404s images that belong to an authorized item — enforced by
 * image-key-lookup.integration.test.ts.
 */
export function itemOwningImageKeyWhere(
  fileKey: string,
): Prisma.ItemWhereInput {
  return {
    OR: [
      { fileKey },
      { coverFileKey: fileKey },
      { faviconFileKey: fileKey },
      { productDetails: { images: { array_contains: [{ fileKey }] } } },
      { twitterDetails: { media: { array_contains: [{ fileKey }] } } },
      { twitterDetails: { card: { path: ["imageFileKey"], equals: fileKey } } },
      { twitterDetails: { authorAvatarFileKey: fileKey } },
      { instagramDetails: { media: { array_contains: [{ fileKey }] } } },
      {
        documentPages: {
          some: { OR: [{ fileKey }, { originalFileKey: fileKey }] },
        },
      },
    ],
  };
}

/**
 * Find the item that owns `fileKey`, selecting the fields needed to decide
 * viewability. Returns null when no item references the key.
 */
export function findItemOwningImageKey(fileKey: string) {
  return db.item.findFirst({
    where: itemOwningImageKeyWhere(fileKey),
    select: { id: true, ...itemAccessSelect },
  });
}
