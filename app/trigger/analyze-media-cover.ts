import { createClient } from "@supabase/supabase-js";
import { logger, task, tasks } from "@trigger.dev/sdk";
import { truncateToTokenLimit } from "../src/lib/ai/generate-tags-from-content";
import db from "../src/lib/db";
import { isReplicateConfigured } from "../src/lib/embeddings";
import { analyzeImageBytes } from "../src/lib/image-analysis/analyze-image-bytes";
import { markProcessingActive } from "../src/lib/items/mark-processing-active";
import {
  healMediaAnalysisEmbedding,
  mirrorCoverAnalysisToItem,
  upsertMediaAnalysis,
} from "../src/lib/items/media-analysis";
import { classifyFailureReason } from "../src/lib/items/processing-error";
import { captureServerException } from "../src/lib/posthog-server";
import {
  formatStorageError,
  getMimeTypeFromFileKey,
  getSupabaseConfig,
} from "./analyze-image";
import type { enrichItemTask } from "./enrich-item";
import { imageAnalysisQueue } from "./queues";

const EMBEDDING_TOKEN_LIMIT = 8191;

type AnalyzeMediaCoverPayload = {
  itemId: string;
  userId: string;
  /** The cover image to analyse + mirror to item-level. */
  fileKey: string;
  /** Item text (e.g. a tweet's text) blended into the enrichment sourceText. */
  extraSourceText?: string;
};

/**
 * Analyse one media image (a multi-image item's cover) into the per-image cache
 * (item_media_analysis), mirror it into the 1-per-item surfaces that drive
 * search + similar-images, and enrich so tags + the text embedding follow the
 * cover (blended with the item's own text). Idempotent + cache-aware: an
 * already-analysed image (e.g. a cover the user swaps back to) skips vision and
 * just re-mirrors.
 *
 * For a tweet captured with a cover this is the sole enrichment (no racing
 * text-only enrich); for a cover swap it re-runs against the already-completed
 * item. On failure it only marks a not-yet-completed item failed, so a swap or
 * backfill can't regress a completed item.
 */
export const analyzeMediaCoverTask = task({
  id: "analyze-media-cover",
  retry: { maxAttempts: 2 },
  // Share one concurrency budget with analyze-image so a batch backfill can't
  // fan out enough concurrent Replicate calls to get throttled (dropping the
  // visual embedding).
  queue: imageAnalysisQueue,
  maxDuration: 600,
  run: async (payload: AnalyzeMediaCoverPayload) => {
    const { itemId, userId, fileKey } = payload;

    // Advance the reaper clock — this is a chained pipeline stage
    await markProcessingActive(itemId);

    try {
      return await analyseCover(payload);
    } catch (error) {
      captureServerException(error, userId, {
        task: "analyze-media-cover",
        itemId,
        fileKey,
      });
      // Reflect the failure only if the item hasn't already completed: at
      // capture this is the primary enrichment (mark failed, like analyze-image),
      // but a swap/backfill refinement must not regress a completed item.
      await db.item.updateMany({
        where: { id: itemId, userId, processingStatus: { not: "completed" } },
        data: {
          processingStatus: "failed",
          processingError: classifyFailureReason(error),
        },
      });
      throw error;
    }
  },
});

async function analyseCover(payload: AnalyzeMediaCoverPayload) {
  const { itemId, userId, fileKey, extraSourceText } = payload;

  let cached = await db.itemMediaAnalysis.findUnique({
    where: { itemId_fileKey: { itemId, fileKey } },
    select: { objects: true, ocrText: true, tags: true, embeddingModel: true },
  });

  // A cached row whose visual embedding never landed (e.g. a throttled Replicate
  // call dropped it). Heal just the embedding — but only when Replicate can
  // produce one, else a null embedding is the final state and this would loop.
  const needsHeal =
    cached !== null &&
    cached.embeddingModel === null &&
    isReplicateConfigured();

  if (!cached) {
    logger.log("Analysing cover image (cache miss)", { itemId, fileKey });
    const { supabase, getSignedUrl } = coverStorage(fileKey);

    const { data, error } = await supabase.storage
      .from("items")
      .download(fileKey);
    if (error || !data) {
      throw new Error(
        `Failed to download cover image: ${formatStorageError(error)}`,
      );
    }
    const buffer = Buffer.from(await data.arrayBuffer());

    const analysis = await analyzeImageBytes({
      buffer,
      mimeType: getMimeTypeFromFileKey(fileKey),
      itemId,
      userId,
      getSignedUrl,
    });

    await upsertMediaAnalysis({ itemId, userId, fileKey, analysis });
    cached = {
      objects: analysis.objects,
      ocrText: analysis.ocrText,
      tags: analysis.tags,
      embeddingModel: analysis.embeddingModel,
    };
  } else if (needsHeal) {
    // Vision is already cached — regenerate only the missing embedding (no
    // OpenAI Vision, so no wasted tokens and no re-hitting its rate limit).
    logger.log("Healing cover embedding (skipping vision)", {
      itemId,
      fileKey,
    });
    const healed = await healMediaAnalysisEmbedding({
      itemId,
      userId,
      fileKey,
      getSignedUrl: coverStorage(fileKey).getSignedUrl,
    });
    if (!healed) {
      logger.warn("Cover embedding heal did not land, will retry on a re-run", {
        itemId,
        fileKey,
      });
    }
  } else {
    logger.log("Cover image already analysed (cache hit)", {
      itemId,
      fileKey,
    });
  }

  // Staleness guard: if the cover was swapped since this job was queued, skip
  // mirroring/enriching so a stale job can't clobber the current cover's
  // search + similar-images. The cache write above is still valid (keyed by
  // fileKey) and speeds up a later swap back to this image.
  const item = await db.item.findFirst({
    where: { id: itemId, userId },
    select: { coverFileKey: true },
  });
  if (item?.coverFileKey !== fileKey) {
    logger.log("Cover changed since queued — skipping stale mirror/enrich", {
      itemId,
      fileKey,
      currentCover: item?.coverFileKey ?? null,
    });
    return { success: true, itemId, fileKey, skipped: "stale-cover" };
  }

  // Mirror the cover's analysis into the item-level search/similar surfaces —
  // this is what propagates a freshly-healed embedding into item_visual_vectors.
  await mirrorCoverAnalysisToItem({ itemId, fileKey });

  // A heal only fixes the CLIP embedding; the vision-derived tags + text are
  // unchanged, so skip enrichment (re-running it would re-bill the text
  // embedding for no change). Fresh analysis and cover swaps still re-enrich.
  if (!needsHeal) {
    const sourceText = [extraSourceText, ...cached.objects, cached.ocrText]
      .filter(Boolean)
      .join(" ");

    logger.log("Triggering item enrichment from cover analysis", { itemId });
    await tasks.trigger<typeof enrichItemTask>("enrich-item", {
      itemId,
      userId,
      precomputedTags: cached.tags,
      sourceText: truncateToTokenLimit(sourceText, EMBEDDING_TOKEN_LIMIT),
    });
  }

  return { success: true, itemId, fileKey, analysed: !needsHeal };
}

/**
 * Supabase storage client + a signed-URL helper for one cover image. The signed
 * URL feeds Replicate (embeddings); the client also downloads bytes for vision.
 */
function coverStorage(fileKey: string) {
  const { url, key } = getSupabaseConfig();
  const supabase = createClient(url, key);
  const getSignedUrl = async () => {
    const { data, error } = await supabase.storage
      .from("items")
      .createSignedUrl(fileKey, 3600);
    if (error || !data) {
      throw new Error(
        `Failed to create signed URL: ${formatStorageError(error)}`,
      );
    }
    return data.signedUrl;
  };
  return { supabase, getSignedUrl };
}
