import db from "@/lib/db";

export type VisualEmbeddingCoverage = {
  /** Total image items in the platform. */
  imageItems: number;
  /** Image items that have at least one stored visual embedding. */
  withEmbeddings: number;
};

/**
 * How many image items have a CLIP visual embedding vs. how many exist.
 *
 * Surfaces gaps from the optional Replicate enhancement being unconfigured or
 * failing during processing (graceful degradation leaves such items without a
 * vector).
 *
 * Both counts are taken over the SAME population — items currently `kind =
 * "image"`. A vector alone isn't enough for the numerator: an item can be
 * uploaded as an image (earning a vector), then reassigned to another kind,
 * leaving an orphaned vector. Counting those would push coverage above 100%.
 * We also count distinct items so a future second embedding model per item
 * doesn't inflate the number.
 */
export async function getVisualEmbeddingCoverage(): Promise<VisualEmbeddingCoverage> {
  const [imageItems, withEmbeddingsRows] = await Promise.all([
    db.item.count({ where: { kind: "image" } }),
    db.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT iv.item_id)::int AS count
      FROM item_visual_vectors iv
      JOIN items i ON i.id = iv.item_id
      WHERE i.kind = 'image'
    `,
  ]);

  return {
    imageItems,
    withEmbeddings: withEmbeddingsRows[0]?.count ?? 0,
  };
}
