import { Prisma } from "@prisma/client";
import db from "../db";
import {
  mirrorMediaEmbeddingToVisualVector,
  setMediaAnalysisEmbedding,
} from "../embeddings";
import type { ImageVisionAnalysis } from "../image-analysis/analyze-image-bytes";

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
