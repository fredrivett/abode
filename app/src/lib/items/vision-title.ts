import type { ItemKind } from "@prisma/client";

/**
 * Whether the cover/image vision analysis may set the item's title and
 * description.
 *
 * Only plain image uploads have no better title source, so only they derive
 * their title/description from the vision analysis. Books, products and tweets
 * already have a title/description from their own metadata (book title, product
 * name, tweet author/text) — vision must not clobber those. It still writes the
 * image details (objects, colours, OCR) for every kind either way.
 */
export function visionOwnsTitle(kind: ItemKind | null): boolean {
  return kind === "image";
}

/**
 * Whether an image (re)analysis may write the item's title/description.
 *
 * On top of {@link visionOwnsTitle}, a user who has manually edited the title
 * has taken ownership of the item's naming — so re-analysis (bulk
 * reprocessing, admin retry) must not overwrite it with a fresh vision caption.
 */
export function visionMayWriteTitle(item: {
  kind: ItemKind | null;
  titleEditedByUser: boolean;
}): boolean {
  return visionOwnsTitle(item.kind) && !item.titleEditedByUser;
}
