/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import {
  refreshVisualEmbeddingMean,
  VISUAL_EMBEDDING_MODEL,
} from "@/lib/embeddings";
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

/** Build a 768-dim vector from the given leading components (rest zero), for
 * multi-dimensional fixtures where centering actually changes the ranking. */
function vec(...values: number[]): number[] {
  const v = new Array<number>(768).fill(0);
  values.forEach((x, i) => {
    v[i] = x;
  });
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

  const createImageVec = async (
    userId: string,
    embedding: number[],
  ): Promise<string> => {
    const { write } = await import("@/lib/db");
    const { upsertVisualVector } = await import("@/lib/embeddings");
    const item = await write.item.create({
      data: { id: crypto.randomUUID(), userId, kind: "image" },
    });
    await upsertVisualVector({
      itemId: item.id,
      userId,
      model: VISUAL_EMBEDDING_MODEL,
      embedding,
    });
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

  describe("mean-centering", () => {
    test("refreshVisualEmbeddingMean stores the centroid and returns the count, upserting on re-run", async () => {
      const user = await createUser("owner@example.com");
      await createImageVec(user.id, vec(1));
      await createImageVec(user.id, vec(0.5));

      expect(await refreshVisualEmbeddingMean()).toBe(2);
      // A second run updates the single row rather than duplicating it.
      expect(await refreshVisualEmbeddingMean()).toBe(2);
    });

    test("refreshVisualEmbeddingMean stores nothing for an empty corpus", async () => {
      expect(await refreshVisualEmbeddingMean()).toBe(0);
    });

    test("centering corrects cone-induced ranking: the high-magnitude hub is demoted below the true content match", async () => {
      const user = await createUser("owner@example.com");
      // dim0 = shared "cone" axis, dim1 = content. The hub has a large dim0 so
      // raw inner product ranks it first despite opposite content.
      const seed = await createImageVec(user.id, vec(10, 1));
      const trueMatch = await createImageVec(user.id, vec(8, 1));
      const hub = await createImageVec(user.id, vec(10, -3));

      // Before a mean exists → raw fallback ranks the hub first.
      const raw = await findSimilarImages({
        itemId: seed,
        userId: user.id,
        threshold: -2,
      });
      expect(raw.map((r) => r.id)).toEqual([hub, trueMatch]);

      // After computing the mean → centering removes the shared axis and the
      // true content match ranks above the hub.
      expect(await refreshVisualEmbeddingMean()).toBe(3);
      const centered = await findSimilarImages({
        itemId: seed,
        userId: user.id,
        threshold: -2,
      });
      expect(centered.map((r) => r.id)).toEqual([trueMatch, hub]);
    });

    test("applies the 0.4 centered threshold once a mean exists", async () => {
      const user = await createUser("owner@example.com");
      // Fixtures + their exact negations ⇒ corpus mean is zero ⇒ centered score
      // equals plain cosine, so we can set similarities precisely.
      const seed = await createImageVec(user.id, vec(1, 0));
      const passes = await createImageVec(user.id, vec(0.5, 0.866)); // cos 0.5 ≥ 0.4
      await createImageVec(user.id, vec(0.3, 0.954)); // cos 0.3 < 0.4 → dropped
      await createImageVec(user.id, vec(-1, 0));
      await createImageVec(user.id, vec(-0.5, -0.866));
      await createImageVec(user.id, vec(-0.3, -0.954));

      expect(await refreshVisualEmbeddingMean()).toBe(6);
      const results = await findSimilarImages({
        itemId: seed,
        userId: user.id,
      });

      expect(results.map((r) => r.id)).toEqual([passes]);
      expect(results[0].similarity).toBeCloseTo(0.5, 2);
    });
  });
});
