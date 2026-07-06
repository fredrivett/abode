import type { ItemKind, Prisma } from "@prisma/client";

/**
 * A per-kind detail model — every Prisma model named `Item<Something>Details`.
 * Derived from the schema so the set stays authoritative.
 */
type ItemDetailModel = Uncapitalize<
  Extract<Prisma.ModelName, `Item${string}Details`>
>;

/**
 * Runtime list of the detail models, needed to iterate them. Each item kind
 * stores its type-specific data in a separate optional 1:1 table.
 */
const ALL_DETAIL_MODELS = [
  "itemArticleDetails",
  "itemImageDetails",
  "itemTwitterDetails",
  "itemVideoDetails",
  "itemProductDetails",
  "itemBookDetails",
  "itemNoteDetails",
] as const satisfies readonly ItemDetailModel[];

// Compile-time completeness guard: a new Item*Details model in the schema that
// isn't listed in ALL_DETAIL_MODELS makes this Exclude non-never, which then
// violates the `extends never` constraint and fails typecheck.
type AssertNever<T extends never> = T;
type _AllDetailModelsListed = AssertNever<
  Exclude<ItemDetailModel, (typeof ALL_DETAIL_MODELS)[number]>
>;

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

export type PruneItemDetailsOptions = {
  /**
   * Whether image details should be kept. Book/product own image details only
   * when a cover is actually (re)analysed — a coverless reanalysis has no
   * analyze-image run to refresh them, so the previous cover's analysis is
   * stale and should be pruned. Defaults to true (keep whatever the kind owns).
   */
  keepImageDetails?: boolean;
};

/**
 * Detail tables to delete when an item is (re)classified as `keepKind`.
 * Pure — anything not owned by the new kind is stale. Exported for tests.
 */
export function staleDetailModelsForKind(
  keepKind: ItemKind,
  options: PruneItemDetailsOptions = {},
): ItemDetailModel[] {
  const owned = new Set(OWNED_DETAIL_MODELS[keepKind]);
  if (options.keepImageDetails === false) owned.delete("itemImageDetails");
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
  options: PruneItemDetailsOptions = {},
): Promise<void> {
  const delegates = detailDelegates(client);
  await Promise.all(
    staleDetailModelsForKind(keepKind, options).map((model) =>
      delegates[model].deleteMany({ where: { itemId } }),
    ),
  );
}
