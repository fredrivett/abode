import type { Prisma } from "@prisma/client";
import type { ImageVisionAnalysis } from "./analyze-image-bytes";

/**
 * The itemImageDetails UPDATE payload for a reprocess. Optional-service-derived
 * fields come back empty when their service is unconfigured, so only overwrite
 * each when we actually produced it — otherwise a degraded reprocess (e.g. the
 * OpenAI key removed after items were enriched) would silently wipe a prior
 * enrichment. objects/ocrText/visionData ← OpenAI; colors ← Google Vision.
 * blurDataUrl + captureDate are deterministic (local/EXIF) so always refresh.
 */
export function buildImageDetailsUpdate(
  analysis: Pick<
    ImageVisionAnalysis,
    "openaiConfigured" | "objects" | "ocrText" | "visionData" | "colors"
  > & { blurDataUrl: string | null },
  captureDate: Date | null,
): Prisma.ItemImageDetailsUpdateInput {
  const update: Prisma.ItemImageDetailsUpdateInput = {
    blurDataUrl: analysis.blurDataUrl,
    captureDate,
  };
  if (analysis.openaiConfigured) {
    update.objects = analysis.objects;
    update.ocrText = analysis.ocrText;
    update.visionData = analysis.visionData as unknown as Prisma.InputJsonValue;
  }
  if (analysis.colors.length > 0) {
    update.colors = analysis.colors as unknown as Prisma.InputJsonValue;
  }
  return update;
}
