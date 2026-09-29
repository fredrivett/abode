import type { Prisma } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { logger, task, tasks } from "@trigger.dev/sdk";
import { truncateToTokenLimit } from "../src/lib/ai/generate-tags-from-content";
import db from "../src/lib/db";
import { combinePageText } from "../src/lib/documents/combine-page-text";
import {
  type DocumentDescription,
  describeDocument,
} from "../src/lib/documents/describe-document";
import {
  extractPageText,
  MAX_OCR_PAGES_PER_DOCUMENT,
} from "../src/lib/documents/document-ocr";
import {
  upsertVisualVector,
  VISUAL_EMBEDDING_MODEL,
} from "../src/lib/embeddings";
import { analyzeImageBytes } from "../src/lib/image-analysis/analyze-image-bytes";
import { buildImageDetailsUpdate } from "../src/lib/image-analysis/image-details-write";
import { markProcessingActive } from "../src/lib/items/mark-processing-active";
import { classifyFailureReason } from "../src/lib/items/processing-error";
import { visionMayWriteTitle } from "../src/lib/items/vision-title";
import { captureServerException } from "../src/lib/posthog-server";
import {
  formatStorageError,
  getMimeTypeFromFileKey,
  getSupabaseConfig,
} from "./analyze-image";
import type { enrichItemTask } from "./enrich-item";
import { imageAnalysisQueue } from "./queues";

const EMBEDDING_TOKEN_LIMIT = 8191;

type AnalyzeDocumentPayload = {
  itemId: string;
  userId: string;
  /** Cap on pages to OCR — set by a PDF import from the user's allowance */
  maxOcrPages?: number;
};

/**
 * Document pipeline, for scans and imported PDFs:
 *   1. OCR every page without text into `item_document_pages.ocr_text` (Google
 *      Vision, else OpenAI). Pages that already have text — a PDF's text layer,
 *      or a previous attempt's OCR — are skipped, so a PDF only pays for its
 *      scanned pages and a retry only for the pages that didn't finish.
 *   2. Vision-analyse the cover (page 1) like an image upload — colours,
 *      objects, blur, CLIP vector. Pages look alike, so the others aren't
 *      analysed visually. Meanwhile, title and describe the document from its
 *      text (issuer, type, date), falling back to the cover's caption.
 *   3. Store the combined text as the item's OCR text (searched and shown like
 *      an image's), then enrich-item derives tags + the text embedding from it.
 *
 * Marks the item `failed` on error so the UI offers Retry.
 */
export const analyzeDocumentTask = task({
  id: "analyze-document",
  retry: { maxAttempts: 2 },
  queue: imageAnalysisQueue,
  maxDuration: 1800, // up to MAX_OCR_PAGES_PER_DOCUMENT OCR calls plus the cover analysis
  run: async ({ itemId, userId, maxOcrPages }: AnalyzeDocumentPayload) => {
    await markProcessingActive(itemId);
    try {
      const result = await analyzeDocumentPages({
        itemId,
        userId,
        maxOcrPages,
      });
      return { success: true, itemId, ...result };
    } catch (error) {
      await markDocumentFailed({
        itemId,
        userId,
        error,
        task: "analyze-document",
      });
      throw error;
    }
  },
});

/**
 * Log, report and mark a document `failed` (so the UI offers Retry, or explains
 * why not) with a safe reason code.
 */
export async function markDocumentFailed({
  itemId,
  userId,
  error,
  task,
}: {
  itemId: string;
  userId: string;
  error: unknown;
  task: string;
}): Promise<void> {
  logger.error("Document processing failed", { itemId, task, error });
  captureServerException(error, userId, { task, itemId });
  await db.item.update({
    where: { id: itemId, userId },
    data: {
      processingStatus: "failed",
      processingError: classifyFailureReason(error),
    },
  });
}

/**
 * The document pipeline (steps above) for an item whose pages are saved: shared
 * by scanned documents and imported PDFs. Throws on failure; the calling task
 * marks the item failed.
 *
 * `maxOcrPages` bounds how many pages without text are OCR'd — the rest stay
 * viewable but unsearchable, counted on `meta.ocrSkippedPages`. A scan never
 * reaches the default; a long scanned PDF can.
 */
export async function analyzeDocumentPages({
  itemId,
  userId,
  maxOcrPages = MAX_OCR_PAGES_PER_DOCUMENT,
}: {
  itemId: string;
  userId: string;
  maxOcrPages?: number;
}): Promise<{ pages: number; pagesWithText: number; ocrSkippedPages: number }> {
  const { url, key } = getSupabaseConfig();
  const supabase = createClient(url, key);

  const download = async (fileKey: string): Promise<Buffer> => {
    const { data, error } = await supabase.storage
      .from("items")
      .download(fileKey);
    if (error || !data) {
      throw new Error(
        `Failed to download ${fileKey}: ${formatStorageError(error)}`,
      );
    }
    return Buffer.from(await data.arrayBuffer());
  };

  const pages = await db.itemDocumentPage.findMany({
    where: { itemId, item: { userId } },
    orderBy: { position: "asc" },
  });
  if (pages.length === 0) throw new Error("Document has no pages");

  // Step 1: OCR each page without text — sequentially, to stay gentle on rate
  // limits. The colour original carries the most detail for OCR.
  const pageTexts: { position: number; ocrText: string | null }[] = [];
  let ocrCalls = 0;
  let ocrSkippedPages = 0;
  for (const page of pages) {
    if (page.ocrText !== null) {
      pageTexts.push(page);
      continue;
    }
    if (ocrCalls >= maxOcrPages) {
      ocrSkippedPages++;
      pageTexts.push({ position: page.position, ocrText: null });
      continue;
    }
    ocrCalls++;
    const { text } = await extractPageText({
      buffer: await download(page.originalFileKey),
      mimeType: getMimeTypeFromFileKey(page.originalFileKey),
      userId,
      itemId,
    });
    if (text !== null) {
      await db.itemDocumentPage.update({
        where: { id: page.id },
        data: { ocrText: text },
      });
    }
    pageTexts.push({ position: page.position, ocrText: text });
  }
  const documentText = combinePageText({ pages: pageTexts });
  const pagesWithText = pageTexts.filter((p) => p.ocrText).length;
  logger.log("Document text complete", {
    itemId,
    pages: pages.length,
    pagesWithText,
    ocrCalls,
    ocrSkippedPages,
  });

  // Step 2: Analyse the cover like an image upload, and title the
  // document from its text. The cover's own OCR would be discarded for the
  // page text, so it isn't requested.
  await markProcessingActive(itemId);
  const item = await db.item.findFirstOrThrow({
    where: { id: itemId, userId },
    select: { kind: true, titleEditedByUser: true, meta: true },
  });
  const mayWriteTitle = visionMayWriteTitle(item);
  const cover = pages[0];
  const coverBuffer = await download(cover.fileKey);
  const [analysis, described] = await Promise.all([
    analyzeImageBytes({
      buffer: coverBuffer,
      mimeType: getMimeTypeFromFileKey(cover.fileKey),
      itemId,
      userId,
      source: "upload",
      ocr: false,
      getSignedUrl: async () => {
        const { data, error } = await supabase.storage
          .from("items")
          .createSignedUrl(cover.fileKey, 3600);
        if (error || !data) {
          throw new Error(
            `Failed to create signed URL: ${formatStorageError(error)}`,
          );
        }
        return data.signedUrl;
      },
    }),
    mayWriteTitle && documentText
      ? describeFromText({ text: documentText, userId, itemId })
      : null,
  ]);

  // Step 3: Persist. The item's OCR text is every page's, not the cover's
  const coverAnalysis = { ...analysis, ocrText: documentText };
  const naming =
    described ??
    (analysis.openaiConfigured
      ? { title: analysis.title, description: analysis.description }
      : null);
  const itemUpdate: Prisma.ItemUpdateInput = {};
  if (naming && mayWriteTitle) {
    itemUpdate.title = naming.title;
    itemUpdate.description = naming.description;
  }
  const meta = withOcrSkippedPages(item.meta, ocrSkippedPages);
  if (meta) itemUpdate.meta = meta;
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  if (Object.keys(itemUpdate).length > 0) {
    ops.push(
      db.item.update({ where: { id: itemId, userId }, data: itemUpdate }),
    );
  }
  ops.push(
    db.itemImageDetails.upsert({
      where: { itemId },
      create: {
        itemId,
        objects: coverAnalysis.objects,
        ocrText: coverAnalysis.ocrText,
        colors: coverAnalysis.colors,
        visionData: coverAnalysis.visionData,
        blurDataUrl: coverAnalysis.blurDataUrl,
      },
      update: {
        ...buildImageDetailsUpdate(coverAnalysis, null),
        // The OCR text comes from the page OCR, not vision — write it even
        // when OpenAI (which gates the vision fields) isn't configured
        ocrText: documentText,
      },
    }),
  );
  await db.$transaction(ops);

  // The CLIP vector is optional: a write error mustn't fail the document
  if (analysis.embedding) {
    try {
      await upsertVisualVector({
        itemId,
        userId,
        model: analysis.embeddingModel ?? VISUAL_EMBEDDING_MODEL,
        embedding: analysis.embedding,
      });
    } catch (error) {
      logger.warn("Visual embedding persistence skipped (write error)", {
        itemId,
        error,
      });
      captureServerException(error, userId, {
        source: "analyze-document:visual-embedding",
        itemId,
      });
    }
  }

  // Step 4: Tags + text embedding from the document's text (not the
  // cover's look), then room sync
  const sourceText = [documentText, ...analysis.objects]
    .filter(Boolean)
    .join("\n\n");
  await tasks.trigger<typeof enrichItemTask>("enrich-item", {
    itemId,
    userId,
    sourceText: truncateToTokenLimit(sourceText, EMBEDDING_TOKEN_LIMIT),
  });

  return { pages: pages.length, pagesWithText, ocrSkippedPages };
}

/**
 * The item's meta with `ocrSkippedPages` set to `skipped` (removed at 0), or
 * null when it's unchanged and needn't be written.
 */
function withOcrSkippedPages(
  meta: Prisma.JsonValue,
  skipped: number,
): Prisma.InputJsonObject | null {
  const current =
    meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
  const { ocrSkippedPages: previous, ...rest } = current;
  if ((previous ?? 0) === skipped) return null;
  return skipped > 0 ? { ...rest, ocrSkippedPages: skipped } : rest;
}

/**
 * The text-derived title, or null to fall back to the cover's caption. An
 * optional enhancement: a failed call is reported, never fatal.
 */
async function describeFromText(params: {
  text: string;
  userId: string;
  itemId: string;
}): Promise<DocumentDescription | null> {
  try {
    return await describeDocument(params);
  } catch (error) {
    logger.warn("Document description failed — using the cover's title", {
      itemId: params.itemId,
      error,
    });
    captureServerException(error, params.userId, {
      source: "analyze-document:describe",
      itemId: params.itemId,
    });
    return null;
  }
}
