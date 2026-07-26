/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import { getVisualEmbeddingCoverage } from "@/lib/admin/embedding-coverage";
import { VISUAL_EMBEDDING_MODEL } from "@/lib/embeddings";

describe("getVisualEmbeddingCoverage integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const createUser = async (email: string) => {
    const { write } = await import("@/lib/db");
    return write.user.create({ data: { id: crypto.randomUUID(), email } });
  };

  const createImage = async (userId: string, withVector: boolean) => {
    const { write } = await import("@/lib/db");
    const { upsertVisualVector } = await import("@/lib/embeddings");
    const item = await write.item.create({
      data: { id: crypto.randomUUID(), userId, kind: "image" },
    });
    if (withVector) {
      await upsertVisualVector({
        itemId: item.id,
        userId,
        model: VISUAL_EMBEDDING_MODEL,
        embedding: new Array<number>(768)
          .fill(0)
          .map((_, i) => (i === 0 ? 1 : 0)),
      });
    }
    return item.id;
  };

  test("counts distinct image items with a stored embedding", async () => {
    const user = await createUser("coverage@example.com");
    await createImage(user.id, true);
    await createImage(user.id, true);
    await createImage(user.id, false); // no embedding

    const coverage = await getVisualEmbeddingCoverage();

    expect(coverage.imageItems).toBe(3);
    expect(coverage.withEmbeddings).toBe(2);
  });

  test("excludes non-image items from the image total", async () => {
    const user = await createUser("coverage@example.com");
    const { write } = await import("@/lib/db");
    await write.item.create({
      data: { id: crypto.randomUUID(), userId: user.id, kind: "note" },
    });
    await createImage(user.id, true);

    const coverage = await getVisualEmbeddingCoverage();

    expect(coverage.imageItems).toBe(1);
    expect(coverage.withEmbeddings).toBe(1);
  });

  test("ignores vectors on items reassigned away from image (no >100%)", async () => {
    const user = await createUser("coverage@example.com");
    await createImage(user.id, true); // one genuine image with a vector

    // Simulate an item that earned a visual vector as an image, then was
    // reassigned to another kind — the orphaned vector must not be counted.
    const { write } = await import("@/lib/db");
    const { upsertVisualVector } = await import("@/lib/embeddings");
    const reassigned = await write.item.create({
      data: { id: crypto.randomUUID(), userId: user.id, kind: "image" },
    });
    await upsertVisualVector({
      itemId: reassigned.id,
      userId: user.id,
      model: VISUAL_EMBEDDING_MODEL,
      embedding: new Array<number>(768)
        .fill(0)
        .map((_, i) => (i === 0 ? 1 : 0)),
    });
    await write.item.update({
      where: { id: reassigned.id },
      data: { kind: "product" },
    });

    const coverage = await getVisualEmbeddingCoverage();

    expect(coverage.imageItems).toBe(1);
    expect(coverage.withEmbeddings).toBe(1);
  });

  test("reports zero coverage on an empty platform", async () => {
    const coverage = await getVisualEmbeddingCoverage();
    expect(coverage).toEqual({ imageItems: 0, withEmbeddings: 0 });
  });
});
