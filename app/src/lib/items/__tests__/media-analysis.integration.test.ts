/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import type { ImageVisionAnalysis } from "@/lib/image-analysis/analyze-image-bytes";
import {
  mirrorCoverAnalysisToItem,
  upsertMediaAnalysis,
} from "@/lib/items/media-analysis";

function analysis(
  overrides: Partial<ImageVisionAnalysis> = {},
): ImageVisionAnalysis {
  return {
    title: "t",
    description: "d",
    objects: ["chair"],
    ocrText: "hello world",
    tags: ["furniture"],
    colors: [],
    visionData: {
      source: "hybrid",
      openai: {
        model: "gpt-x",
        usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
      },
      visionApiFeatures: ["IMAGE_PROPERTIES"],
    },
    // item_visual_vectors is vector(768); the mirror copies into it
    embedding: Array.from({ length: 768 }, () => 0.01),
    embeddingModel: "clip-vit-base-patch32",
    ...overrides,
  };
}

async function seedTweet() {
  const { write } = await import("@/lib/db");
  const user = await write.user.create({
    data: {
      id: crypto.randomUUID(),
      email: `ma-${crypto.randomUUID()}@example.com`,
    },
  });
  const item = await write.item.create({
    data: {
      id: crypto.randomUUID(),
      userId: user.id,
      kind: "twitter",
      processingStatus: "completed",
    },
    select: { id: true },
  });
  return { userId: user.id, itemId: item.id };
}

describe("media-analysis persistence", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  test("upsertMediaAnalysis caches per-image keyed by fileKey (idempotent + embedding)", async () => {
    const { read } = await import("@/lib/db");
    const { userId, itemId } = await seedTweet();
    const fileKey = `${userId}/a.jpg`;

    await upsertMediaAnalysis({
      itemId,
      userId,
      fileKey,
      analysis: analysis(),
    });
    // Re-analysing the same image updates the one row, doesn't duplicate it
    await upsertMediaAnalysis({
      itemId,
      userId,
      fileKey,
      analysis: analysis({ objects: ["sofa"] }),
    });

    const rows = await read.itemMediaAnalysis.findMany({ where: { itemId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].objects).toEqual(["sofa"]);

    const [{ has_embedding }] = await read.$queryRaw<
      { has_embedding: boolean }[]
    >`SELECT embedding IS NOT NULL AS has_embedding FROM item_media_analysis WHERE item_id = ${itemId}::uuid AND file_key = ${fileKey}`;
    expect(has_embedding).toBe(true);
  });

  test("mirrorCoverAnalysisToItem projects the cover into item-level surfaces", async () => {
    const { read } = await import("@/lib/db");
    const { userId, itemId } = await seedTweet();
    const fileKey = `${userId}/a.jpg`;

    await upsertMediaAnalysis({
      itemId,
      userId,
      fileKey,
      analysis: analysis({ objects: ["chair"], ocrText: "menu text" }),
    });
    await mirrorCoverAnalysisToItem({ itemId, fileKey });

    const details = await read.itemImageDetails.findUnique({
      where: { itemId },
    });
    expect(details?.objects).toEqual(["chair"]);
    expect(details?.ocrText).toBe("menu text");

    const vectors = await read.itemVisualVector.findMany({ where: { itemId } });
    expect(vectors).toHaveLength(1);
  });

  test("swapping the cover re-points item-level from cache, no re-analysis", async () => {
    const { read } = await import("@/lib/db");
    const { userId, itemId } = await seedTweet();
    const keyA = `${userId}/a.jpg`;
    const keyB = `${userId}/b.jpg`;

    // Both images analysed once (cached)
    await upsertMediaAnalysis({
      itemId,
      userId,
      fileKey: keyA,
      analysis: analysis({ objects: ["chair"] }),
    });
    await upsertMediaAnalysis({
      itemId,
      userId,
      fileKey: keyB,
      analysis: analysis({ objects: ["table"] }),
    });

    const objectsNow = async () =>
      (await read.itemImageDetails.findUnique({ where: { itemId } }))?.objects;

    await mirrorCoverAnalysisToItem({ itemId, fileKey: keyA });
    expect(await objectsNow()).toEqual(["chair"]);

    await mirrorCoverAnalysisToItem({ itemId, fileKey: keyB });
    expect(await objectsNow()).toEqual(["table"]);

    // Swap back to A: pulls from cache, re-points item-level — no new cache rows
    await mirrorCoverAnalysisToItem({ itemId, fileKey: keyA });
    expect(await objectsNow()).toEqual(["chair"]);
    expect(await read.itemMediaAnalysis.count({ where: { itemId } })).toBe(2);
  });
});
