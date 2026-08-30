import { recordAiUsage } from "../ai-costs/record-ai-usage";
import {
  generateImageEmbedding,
  isOpenAiConfigured,
  isReplicateConfigured,
  VISUAL_EMBEDDING_MODEL,
} from "../embeddings";
import { createLogger } from "../logger.server";
import { captureServerException } from "../posthog-server";
import {
  analyzeImageColorsOnly,
  type ImageColor,
  isGoogleVisionConfigured,
} from "../vision";
import { generateBlurDataUrl } from "./blur-placeholder";
import { analyzeImageWithOpenAI } from "./openai-vision";

const log = createLogger("lib/analyze-image-bytes");

type OpenAiVisionResult = Awaited<ReturnType<typeof analyzeImageWithOpenAI>>;

export type ImageVisionAnalysis = {
  title: string;
  description: string;
  objects: string[];
  ocrText: string | null;
  tags: string[];
  colors: ImageColor[];
  visionData: {
    source: "hybrid";
    /** null when OpenAI is unconfigured — the vision pass was skipped. */
    openai: { model: string; usage: OpenAiVisionResult["usage"] } | null;
    visionApiFeatures: string[];
  };
  /** CLIP visual embedding, or null when Replicate is unconfigured or errored. */
  embedding: number[] | null;
  embeddingModel: string | null;
  /** Tiny blurred-placeholder data URL (LQIP), or null if the image can't be decoded. */
  blurDataUrl: string | null;
  /**
   * False when OPENAI_API_KEY is unset: the AI title/description/tags/objects/OCR
   * were skipped and come back empty. Callers must not overwrite an item's title
   * from this result when false (see analyze-image).
   */
  openaiConfigured: boolean;
};

/**
 * Run the shared vision pipeline on one image's bytes: Google Vision colours +
 * OpenAI Vision (title/description/objects/OCR/tags) in parallel, plus the
 * optional CLIP visual embedding. Records AI usage per call.
 *
 * Pure compute — writes nothing to the DB; the caller persists the result
 * wherever it belongs (item_image_details for single-image kinds,
 * item_media_analysis for multi-image kinds). Replicate is an optional service:
 * a missing key or a failure yields `embedding: null` and never throws, matching
 * the graceful-degradation pattern. `getSignedUrl` is only invoked when a CLIP
 * embedding will actually be generated.
 */
export async function analyzeImageBytes(params: {
  buffer: Buffer;
  mimeType: string;
  itemId: string;
  userId: string;
  getSignedUrl: () => Promise<string>;
}): Promise<ImageVisionAnalysis> {
  const { buffer, mimeType, itemId, userId, getSignedUrl } = params;

  const openaiConfigured = isOpenAiConfigured();

  // Record each paid call's usage the moment it resolves, inside its own branch
  // — not after the Promise.all. If one rejects, Promise.all skips everything
  // after it, so a shared post-await recording would drop the sibling's cost.
  // recordAiUsage never throws, so it can't affect the Promise.all outcome.
  //
  // Google Vision (colours) and OpenAI (title/tags/OCR) are both optional
  // enhancements: skip cleanly when unconfigured, and never let one failing fail
  // the analysis. A minimal deploy (no OpenAI, no Google key) still returns a
  // usable result — bare image details plus the local blur placeholder.
  const [colors, openaiResult, blurDataUrl] = await Promise.all([
    (async (): Promise<ImageColor[]> => {
      if (!isGoogleVisionConfigured()) return [];
      try {
        const result = await analyzeImageColorsOnly(buffer);
        recordAiUsage({
          userId,
          itemId,
          provider: "google_vision",
          operation: "vision_analysis",
          model: "IMAGE_PROPERTIES",
          images: 1,
          source: "ingestion",
        });
        return result;
      } catch (error) {
        captureServerException(error, userId, {
          source: "analyze-image-bytes:colors",
          itemId,
        });
        return [];
      }
    })(),
    (async (): Promise<OpenAiVisionResult | null> => {
      if (!openaiConfigured) return null;
      const result = await analyzeImageWithOpenAI(buffer, mimeType);
      recordAiUsage({
        userId,
        itemId,
        provider: "openai",
        operation: "vision_analysis",
        model: result.model,
        inputTokens: result.usage.promptTokens,
        outputTokens: result.usage.completionTokens,
        source: "ingestion",
      });
      return result;
    })(),
    // LQIP blur placeholder — local compute, best-effort (never throws)
    generateBlurDataUrl(buffer),
  ]);

  if (!openaiConfigured) {
    log.info(
      { itemId },
      "OpenAI not configured — skipping vision analysis (title/description/tags/OCR)",
    );
  }

  const analysis = openaiResult?.analysis ?? null;

  const visionData = {
    source: "hybrid" as const,
    openai: openaiResult
      ? { model: openaiResult.model, usage: openaiResult.usage }
      : null,
    visionApiFeatures: colors.length > 0 ? ["IMAGE_PROPERTIES"] : [],
  };

  // CLIP visual embedding — optional. Skip cleanly when Replicate isn't
  // configured, and never let a Replicate failure fail the analysis.
  let embedding: number[] | null = null;
  let embeddingModel: string | null = null;
  if (isReplicateConfigured()) {
    try {
      const signedUrl = await getSignedUrl();
      embedding = await generateImageEmbedding(signedUrl);
      embeddingModel = VISUAL_EMBEDDING_MODEL;
      recordAiUsage({
        userId,
        itemId,
        provider: "replicate",
        operation: "image_embedding",
        model: "clip-vit-base-patch32",
        images: 1,
        source: "ingestion",
      });
    } catch (error) {
      // Optional enhancement failing must not fail the analysis — report, continue
      captureServerException(error, userId, {
        source: "analyze-image-bytes:visual-embedding",
        itemId,
      });
      embedding = null;
      embeddingModel = null;
    }
  }

  return {
    title: analysis?.title ?? "",
    description: analysis?.description ?? "",
    objects: analysis?.objects ?? [],
    ocrText: analysis?.ocrText ?? null,
    tags: analysis?.tags ?? [],
    colors,
    visionData,
    embedding,
    embeddingModel,
    blurDataUrl,
    openaiConfigured,
  };
}
