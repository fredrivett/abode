import type { ItemKind, Prisma } from "@prisma/client";

/**
 * All per-kind detail tables. Each item kind stores its type-specific data in a
 * separate optional 1:1 table.
 */
const ALL_DETAIL_MODELS = [
  "itemArticleDetails",
  "itemImageDetails",
  "itemTwitterDetails",
  "itemVideoDetails",
  "itemProductDetails",
  "itemBookDetails",
  "itemNoteDetails",
] as const;

type ItemDetailModel = (typeof ALL_DETAIL_MODELS)[number];

/**
 * The detail tables that legitimately hold data for an item of a given kind.
 * Book and product covers are visually analysed (analyze-image writes image
 * details), so those kinds own image details alongside their primary table.
 * A webpage has no detail table.
 */
const OWNED_DETAIL_MODELS: Record<ItemKind, readonly ItemDetailModel[]> = {
  image: ["itemImageDetails"],
  article: ["itemArticleDetails"],
  twitter: ["itemTwitterDetails"],
  video: ["itemVideoDetails"],
  product: ["itemProductDetails", "itemImageDetails"],
  book: ["itemBookDetails", "itemImageDetails"],
  note: ["itemNoteDetails"],
  webpage: [],
};

/**
 * Detail tables to delete when an item is (re)classified as `keepKind`.
 * Pure — anything not owned by the new kind is stale. Exported for tests.
 */
export function staleDetailModelsForKind(
  keepKind: ItemKind,
): ItemDetailModel[] {
  const owned = new Set(OWNED_DETAIL_MODELS[keepKind]);
  return ALL_DETAIL_MODELS.filter((model) => !owned.has(model));
}

type DetailDelegate = {
  deleteMany: (args: { where: { itemId: string } }) => Promise<unknown>;
};

// Explicit map avoids dynamic delegate indexing (which trips the union-of-
// call-signatures error) while staying typed against the Prisma client.
function detailDelegates(
  client: Prisma.TransactionClient,
): Record<ItemDetailModel, DetailDelegate> {
  return {
    itemArticleDetails: client.itemArticleDetails,
    itemImageDetails: client.itemImageDetails,
    itemTwitterDetails: client.itemTwitterDetails,
    itemVideoDetails: client.itemVideoDetails,
    itemProductDetails: client.itemProductDetails,
    itemBookDetails: client.itemBookDetails,
    itemNoteDetails: client.itemNoteDetails,
  };
}

/**
 * Remove detail rows that don't belong to an item's new kind.
 *
 * Reanalysis can change an item's kind (e.g. article → product). Each kind's
 * data lives in a separate 1:1 detail table, and the handlers only upsert their
 * own — so without this the previous kind's row would be orphaned in the DB.
 * Accepts a transaction client (or the base client) so it can run atomically
 * with the item's kind update.
 */
export async function pruneStaleItemDetails(
  client: Prisma.TransactionClient,
  itemId: string,
  keepKind: ItemKind,
): Promise<void> {
  const delegates = detailDelegates(client);
  await Promise.all(
    staleDetailModelsForKind(keepKind).map((model) =>
      delegates[model].deleteMany({ where: { itemId } }),
    ),
  );
}
