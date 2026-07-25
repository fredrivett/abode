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
 * vector). Counts distinct items so a future second embedding model per item
 * doesn't inflate the number.
 */
export async function getVisualEmbeddingCoverage(): Promise<VisualEmbeddingCoverage> {
  const [imageItems, withEmbeddingsRows] = await Promise.all([
    db.item.count({ where: { kind: "image" } }),
    db.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT item_id)::int AS count FROM item_visual_vectors
    `,
  ]);

  return {
    imageItems,
    withEmbeddings: withEmbeddingsRows[0]?.count ?? 0,
  };
}
