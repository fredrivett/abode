import type { Prisma } from "@prisma/client";
import db from "@/lib/db";
import { itemAccessSelect } from "./access";

/**
 * Where-clause matching the item that owns an image `fileKey`, for the image
 * proxy to authorize a request. Re-hostable keys live in several places: the
 * item's own `fileKey`/`coverFileKey`, and inside JSON blobs — the product
 * gallery (`ItemProductDetails.images`), a tweet's media stills
 * (`ItemTwitterDetails.media[].fileKey`), and a tweet's link-card image
 * (`ItemTwitterDetails.card.imageFileKey`). JSONB containment matches these
 * without scanning every row.
 *
 * Any new kind that stores keys in JSON must be added here, or the proxy will
 * 404 those images even though they belong to an authorized item.
 */
export function itemOwningImageKeyWhere(
  fileKey: string,
): Prisma.ItemWhereInput {
  return {
    OR: [
      { fileKey },
      { coverFileKey: fileKey },
      { productDetails: { images: { array_contains: [{ fileKey }] } } },
      { twitterDetails: { media: { array_contains: [{ fileKey }] } } },
      { twitterDetails: { card: { path: ["imageFileKey"], equals: fileKey } } },
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
