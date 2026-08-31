import { Prisma } from "@prisma/client";
import { recordAiUsage } from "../ai-costs/record-ai-usage";
import db from "../db";
import {
  generateImageEmbedding,
  isReplicateConfigured,
  mirrorMediaEmbeddingToVisualVector,
  setMediaAnalysisEmbedding,
} from "../embeddings";
import type { ImageVisionAnalysis } from "../image-analysis/analyze-image-bytes";
import { reportImageEmbeddingFailure } from "../image-analysis/embedding-failure";

/** Coerce a Prisma JSON read back into a writable input value (JSON null → DB null). */
function toJsonInput(
  value: Prisma.JsonValue | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null || value === undefined
    ? Prisma.JsonNull
    : (value as Prisma.InputJsonValue);
}

/**
 * Upsert the per-image analysis cache row (item_media_analysis), keyed by the
 * stored image. Non-vector columns go via Prisma; the pgvector embedding is set
 * separately (raw SQL) when present.
 */
export async function upsertMediaAnalysis({
  itemId,
  userId,
  fileKey,
  analysis,
}: {
  itemId: string;
  userId: string;
  fileKey: string;
  analysis: ImageVisionAnalysis;
}) {
  const data = {
    objects: analysis.objects,
    ocrText: analysis.ocrText,
    colors: analysis.colors as unknown as Prisma.InputJsonValue,
    tags: analysis.tags,
    visionData: analysis.visionData as unknown as Prisma.InputJsonValue,
    blurDataUrl: analysis.blurDataUrl,
    embeddingModel: analysis.embeddingModel,
  };

  await db.itemMediaAnalysis.upsert({
    where: { itemId_fileKey: { itemId, fileKey } },
    create: { itemId, userId, fileKey, ...data },
    update: data,
  });

  if (analysis.embedding) {
    await setMediaAnalysisEmbedding({
      itemId,
      fileKey,
      embedding: analysis.embedding,
    });
  }
}

/**
 * Mirror a cached cover image's analysis into the item-level surfaces that
 * search + similar-images read: item_image_details and item_visual_vectors, both
 * 1-per-item. A cover swap re-points these by re-mirroring the new cover, so
 * search/sidebar always reflect the currently-selected cover. No-op if the
 * cover hasn't been analysed yet.
 */
export async function mirrorCoverAnalysisToItem({
  itemId,
  fileKey,
}: {
  itemId: string;
  fileKey: string;
}) {
  const cached = await db.itemMediaAnalysis.findUnique({
    where: { itemId_fileKey: { itemId, fileKey } },
    select: {
      objects: true,
      ocrText: true,
      colors: true,
      visionData: true,
      blurDataUrl: true,
    },
  });
  if (!cached) return;

  const imageData = {
    objects: cached.objects,
    ocrText: cached.ocrText,
    colors: toJsonInput(cached.colors),
    visionData: toJsonInput(cached.visionData),
    blurDataUrl: cached.blurDataUrl,
    captureDate: null, // tweet media has no EXIF capture date
  };

  await db.itemImageDetails.upsert({
    where: { itemId },
    create: { itemId, ...imageData },
    update: imageData,
  });

  await mirrorMediaEmbeddingToVisualVector({ itemId, fileKey });
}

/**
 * Regenerate ONLY the missing CLIP embedding for a cover that already has its
 * vision analysis cached (objects/OCR/colours), e.g. one whose embedding was
 * dropped by a throttled Replicate call. Deliberately skips OpenAI Vision — the
 * vision data hasn't changed, so re-running it would burn tokens for nothing and
 * re-hit the vision rate limit. Just the (cheap) Replicate call runs.
 *
 * Graceful: no-op when Replicate is unconfigured, and a Replicate failure leaves
 * the embedding null (to be retried on a later run) rather than throwing.
 *
 * @returns true if an embedding was generated and stored.
 */
export async function healMediaAnalysisEmbedding({
  itemId,
  userId,
  fileKey,
  getSignedUrl,
}: {
  itemId: string;
  userId: string;
  fileKey: string;
  getSignedUrl: () => Promise<string>;
}): Promise<boolean> {
  if (!isReplicateConfigured()) return false;
  try {
    const signedUrl = await getSignedUrl();
    const embedding = await generateImageEmbedding(signedUrl);
    await setMediaAnalysisEmbedding({ itemId, fileKey, embedding });
    recordAiUsage({
      userId,
      itemId,
      provider: "replicate",
      operation: "image_embedding",
      model: "clip-vit-base-patch32",
      images: 1,
      source: "ingestion",
    });
    return true;
  } catch (error) {
    // Optional enhancement failing must not fail the caller — report, leave null.
    // A heal only runs for a tweet's cover; tag the phase so a re-drop here is
    // distinguishable from the initial analysis in the same queryable event.
    reportImageEmbeddingFailure({
      error,
      userId,
      itemId,
      source: "tweet-cover",
      phase: "heal",
      fileKey,
    });
    return false;
  }
}
