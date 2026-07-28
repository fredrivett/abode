import { createClient } from "@supabase/supabase-js";
import { logger, task, tasks } from "@trigger.dev/sdk";
import { truncateToTokenLimit } from "../src/lib/ai/generate-tags-from-content";
import db from "../src/lib/db";
import { analyzeImageBytes } from "../src/lib/image-analysis/analyze-image-bytes";
import {
  mirrorCoverAnalysisToItem,
  upsertMediaAnalysis,
} from "../src/lib/items/media-analysis";
import { captureServerException } from "../src/lib/posthog-server";
import {
  formatStorageError,
  getMimeTypeFromFileKey,
  getSupabaseConfig,
} from "./analyze-image";
import type { enrichItemTask } from "./enrich-item";

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
 * (item_media_analysis), then mirror it into the 1-per-item surfaces that drive
 * search + similar-images, and re-enrich so tags + the text embedding follow the
 * cover. Idempotent + cache-aware: an already-analysed image (e.g. a cover the
 * user swaps back to) skips vision entirely and just re-mirrors.
 *
 * A refinement, not the item's primary processing — the caller has already
 * enriched the item from its own text, so a failure here degrades cleanly
 * (retries; never touches processingStatus).
 */
export const analyzeMediaCoverTask = task({
  id: "analyze-media-cover",
  maxDuration: 600,
  run: async (payload: AnalyzeMediaCoverPayload) => {
    const { itemId, userId, fileKey } = payload;

    try {
      return await analyseCover(payload);
    } catch (error) {
      // A cover-analysis failure must not fail item capture (the item is already
      // enriched from its own text). Report and rethrow so Trigger retries;
      // never touch processingStatus.
      captureServerException(error, userId, {
        task: "analyze-media-cover",
        itemId,
        fileKey,
      });
      throw error;
    }
  },
});

async function analyseCover(payload: AnalyzeMediaCoverPayload) {
  const { itemId, userId, fileKey, extraSourceText } = payload;

  let cached = await db.itemMediaAnalysis.findUnique({
    where: { itemId_fileKey: { itemId, fileKey } },
    select: { objects: true, ocrText: true, tags: true },
  });

  if (!cached) {
    logger.log("Analysing cover image (cache miss)", { itemId, fileKey });
    const { url: supabaseUrl, key: supabaseKey } = getSupabaseConfig();
    const supabase = createClient(supabaseUrl, supabaseKey);

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
      getSignedUrl: async () => {
        const { data: urlData, error: urlError } = await supabase.storage
          .from("items")
          .createSignedUrl(fileKey, 3600);
        if (urlError || !urlData) {
          throw new Error(
            `Failed to create signed URL: ${formatStorageError(urlError)}`,
          );
        }
        return urlData.signedUrl;
      },
    });

    await upsertMediaAnalysis({ itemId, userId, fileKey, analysis });
    cached = {
      objects: analysis.objects,
      ocrText: analysis.ocrText,
      tags: analysis.tags,
    };
  } else {
    logger.log("Cover image already analysed (cache hit)", {
      itemId,
      fileKey,
    });
  }

  // Mirror the cover's analysis into the item-level search/similar surfaces
  await mirrorCoverAnalysisToItem({ itemId, fileKey });

  // Re-enrich so tags + text embedding follow the selected cover, blended with
  // the item's own text (e.g. the tweet text)
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

  return { success: true, itemId, fileKey, analysed: true };
}
