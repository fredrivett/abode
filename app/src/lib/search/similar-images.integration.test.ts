/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import { VISUAL_EMBEDDING_MODEL } from "@/lib/embeddings";
import { findSimilarImages } from "@/lib/search/similar-images";

/**
 * Build a 768-dim vector (matching the `vector(768)` column). Only index 0 is
 * set, so its inner product against the unit seed `[1, 0, …]` equals `primary`
 * exactly — giving each fixture a deterministic, controllable similarity.
 */
function makeVector(primary: number): number[] {
  const v = new Array<number>(768).fill(0);
  v[0] = primary;
  return v;
}

describe("findSimilarImages integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const createUser = async (email: string) => {
    const { write } = await import("@/lib/db");
    return write.user.create({
      data: { id: crypto.randomUUID(), email },
    });
  };

  const createImage = async (
    userId: string,
    similarity: number | null,
  ): Promise<string> => {
    const { write } = await import("@/lib/db");
    const { upsertVisualVector } = await import("@/lib/embeddings");
    const item = await write.item.create({
      data: { id: crypto.randomUUID(), userId, kind: "image" },
    });
    if (similarity !== null) {
      await upsertVisualVector({
        itemId: item.id,
        userId,
        model: VISUAL_EMBEDDING_MODEL,
        embedding: makeVector(similarity),
      });
    }
    return item.id;
  };

  test("returns owner's images most similar first, excluding self", async () => {
    const user = await createUser("owner@example.com");

    const seed = await createImage(user.id, 1); // the source image
    const near = await createImage(user.id, 0.95);
    const mid = await createImage(user.id, 0.8);

    const results = await findSimilarImages({ itemId: seed, userId: user.id });

    expect(results.map((r) => r.id)).toEqual([near, mid]);
    expect(results[0].similarity).toBeCloseTo(0.95, 5);
    expect(results[1].similarity).toBeCloseTo(0.8, 5);
    // The seed itself is never returned
    expect(results.map((r) => r.id)).not.toContain(seed);
  });

  test("excludes images below the similarity threshold", async () => {
    const user = await createUser("owner@example.com");
    const seed = await createImage(user.id, 1);
    await createImage(user.id, 0.95); // above default 0.7
    await createImage(user.id, 0.3); // below — must be dropped

    const results = await findSimilarImages({ itemId: seed, userId: user.id });

    expect(results).toHaveLength(1);
    expect(results[0].similarity).toBeGreaterThanOrEqual(0.7);
  });

  test("never crosses user boundaries", async () => {
    const owner = await createUser("owner@example.com");
    const other = await createUser("other@example.com");

    const seed = await createImage(owner.id, 1);
    await createImage(other.id, 0.99); // very similar but belongs to someone else

    const results = await findSimilarImages({ itemId: seed, userId: owner.id });

    expect(results).toEqual([]);
  });

  test("returns empty when the source item has no visual embedding", async () => {
    const user = await createUser("owner@example.com");
    const seed = await createImage(user.id, null); // no vector stored
    await createImage(user.id, 0.95);

    const results = await findSimilarImages({ itemId: seed, userId: user.id });

    expect(results).toEqual([]);
  });

  test("respects the limit, keeping the closest matches", async () => {
    const user = await createUser("owner@example.com");
    const seed = await createImage(user.id, 1);
    await createImage(user.id, 0.99);
    await createImage(user.id, 0.95);
    await createImage(user.id, 0.9);

    const results = await findSimilarImages({
      itemId: seed,
      userId: user.id,
      limit: 2,
    });

    expect(results).toHaveLength(2);
    expect(results[0].similarity).toBeCloseTo(0.99, 5);
    expect(results[1].similarity).toBeCloseTo(0.95, 5);
  });
});
