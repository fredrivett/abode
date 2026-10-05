import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AbortTaskRunError, logger, task } from "@trigger.dev/sdk";
import db from "../src/lib/db";
import {
  isDocumentOcrConfigured,
  MAX_OCR_PAGES_PER_DOCUMENT,
} from "../src/lib/documents/document-ocr";
import { openPdf } from "../src/lib/documents/render-pdf";
import { enqueueUserProcessing } from "../src/lib/items/enqueue-user-processing";
import { markProcessingActive } from "../src/lib/items/mark-processing-active";
import {
  classifyFailureReason,
  ProcessingFailure,
} from "../src/lib/items/processing-error";
import { getPostHogClient } from "../src/lib/posthog-server";
import { MAX_PDF_UPLOAD_BYTES } from "../src/lib/uploads";
import { guardDailyLimit } from "../src/lib/usage-limits";
import type { analyzeDocumentTask } from "./analyze-document";
import { markDocumentFailed } from "./analyze-document";
import { formatStorageError, getSupabaseConfig } from "./analyze-image";
import { documentImportQueue } from "./queues";

/** Page uploads in flight while the next page renders */
const UPLOAD_CONCURRENCY = 4;

type ImportPdfPayload = {
  itemId: string;
  userId: string;
};

/**
 * Turns an uploaded PDF (`Item.sourceFileKey`) into a document's pages:
 *   1. Render each page to a JPEG and keep its embedded text layer as the
 *      page's text, so only scanned pages need OCR.
 *   2. Save the pages (displayed = original, no filter), make page 1 the cover,
 *      and account the page images' storage.
 *   3. Hand off to analyze-document, which OCRs the pages without text (up to
 *      what the user's daily allowance covers), titles the document and makes
 *      it searchable — the same pipeline as a scan.
 *
 * Idempotent: once pages exist, a retry skips straight to step 3. A damaged,
 * encrypted or over-long PDF fails without retrying, with a reason the UI
 * explains.
 */
export const importPdfTask = task({
  id: "import-pdf",
  retry: {
    maxAttempts: 2,
    // A huge or image-heavy PDF can exhaust the default machine's memory
    outOfMemory: { machine: "small-2x" },
  },
  queue: documentImportQueue,
  maxDuration: 1800, // rendering + uploading up to MAX_PDF_PAGES pages
  run: async ({ itemId, userId }: ImportPdfPayload) => {
    await markProcessingActive(itemId);
    try {
      const item = await db.item.findFirstOrThrow({
        where: { id: itemId, userId },
        select: {
          sourceFileKey: true,
          _count: { select: { documentPages: true } },
        },
      });
      if (!item.sourceFileKey) {
        throw new ProcessingFailure(
          "unsupported_content",
          "Document has no source file to import",
        );
      }

      const imported =
        item._count.documentPages === 0
          ? await renderAndSavePages({
              itemId,
              userId,
              sourceFileKey: item.sourceFileKey,
            })
          : null;
      if (imported?.outcome === "superseded") {
        // The URL was re-captured mid-import; that capture's import takes over
        logger.log("PDF replaced during import — dropping this attempt", {
          itemId,
        });
        return { success: true, itemId, superseded: true };
      }

      const scannedPages = await db.itemDocumentPage.count({
        where: { itemId, ocrText: null },
      });
      const maxOcrPages = await ocrAllowance({ itemId, userId, scannedPages });

      await enqueueUserProcessing<typeof analyzeDocumentTask>(
        "analyze-document",
        { itemId, userId, maxOcrPages },
        userId,
      );

      const pages = imported?.pages ?? item._count.documentPages;
      captureImportEvent(userId, "pdf_imported", {
        item_id: itemId,
        pages,
        scanned_pages: scannedPages,
        ocr_pages: maxOcrPages,
        retried: imported?.outcome !== "saved",
      });

      return {
        success: true,
        itemId,
        rendered: imported?.outcome === "saved",
        pages,
        scannedPages,
        maxOcrPages,
      };
    } catch (error) {
      await markDocumentFailed({ itemId, userId, error, task: "import-pdf" });
      captureImportEvent(userId, "pdf_import_failed", {
        item_id: itemId,
        reason: classifyFailureReason(error),
      });
      // Retrying can't fix a damaged, encrypted or over-long file
      if (
        error instanceof ProcessingFailure &&
        (error.reason === "file_unreadable" ||
          error.reason === "document_too_long")
      ) {
        throw new AbortTaskRunError(error.message);
      }
      throw error;
    }
  },
});

/**
 * How many scanned pages analyze-document may OCR. Each counts as one ingestion
 * action — like a scanned page — so a long scanned PDF draws on the same daily
 * allowance and $ budget as scanning it. When the allowance is spent (and
 * limits are enforced) the pages are kept without text rather than failing the
 * import.
 *
 * Charged once per PDF: the granted count is kept on `meta.ocrPagesCharged`, so
 * a retry (after a failed enqueue or analysis) reuses it instead of paying
 * again. A re-captured URL PDF gets fresh meta, so it's charged afresh.
 */
async function ocrAllowance({
  itemId,
  userId,
  scannedPages,
}: {
  itemId: string;
  userId: string;
  scannedPages: number;
}): Promise<number> {
  const pages = Math.min(scannedPages, MAX_OCR_PAGES_PER_DOCUMENT);
  if (pages === 0 || !isDocumentOcrConfigured()) return pages;

  const { meta } = await db.item.findUniqueOrThrow({
    where: { id: itemId },
    select: { meta: true },
  });
  const previous = isRecord(meta) ? meta : {};
  if (typeof previous.ocrPagesCharged === "number") {
    return Math.min(pages, previous.ocrPagesCharged);
  }

  const guard = await guardDailyLimit(userId, "ingestion", { weight: pages });
  if (!guard.ok) {
    logger.info(
      "Daily allowance reached — importing scanned pages without OCR",
      { userId, scannedPages },
    );
    return 0;
  }
  await db.item.update({
    where: { id: itemId },
    data: { meta: { ...previous, ocrPagesCharged: pages } },
  });
  return pages;
}

/**
 * Steps 1–2: render the item's source PDF and save its pages, cover and
 * storage accounting. Throws a `ProcessingFailure` for a PDF it can't import.
 *
 * The pages are only saved if the item still holds this PDF and has no pages
 * yet: otherwise a URL re-capture replaced it mid-import (`superseded`) or a
 * concurrent attempt saved first (`existing`), and this attempt's images are
 * removed.
 */
export async function renderAndSavePages({
  itemId,
  userId,
  sourceFileKey,
}: {
  itemId: string;
  userId: string;
  sourceFileKey: string;
}): Promise<{
  outcome: "saved" | "existing" | "superseded";
  pages: number;
}> {
  const { url, key } = getSupabaseConfig();
  const supabase = createClient(url, key);

  const { data, error } = await supabase.storage
    .from("items")
    .download(sourceFileKey);
  if (error || !data) {
    throw new Error(
      `Failed to download ${sourceFileKey}: ${formatStorageError(error)}`,
    );
  }
  // The client checks the size before uploading; this catches one that didn't
  if (data.size > MAX_PDF_UPLOAD_BYTES) {
    throw new ProcessingFailure(
      "document_too_long",
      `PDF is ${data.size} bytes (max ${MAX_PDF_UPLOAD_BYTES})`,
    );
  }
  const pdfBytes = new Uint8Array(await data.arrayBuffer());

  const pdf = await openPdf(pdfBytes);
  const uploadedKeys: string[] = [];
  try {
    const pages = await renderPages({ pdf, userId, supabase, uploadedKeys });
    const pageBytes = pages.reduce((total, page) => total + page.size, 0);
    const cover = pages[0];
    const outcome = await db.$transaction(async (tx) => {
      const current = await tx.item.findUnique({
        where: { id: itemId },
        select: { sourceFileKey: true, meta: true },
      });
      if (current?.sourceFileKey !== sourceFileKey) return "superseded";
      const existing = await tx.itemDocumentPage.count({ where: { itemId } });
      if (existing > 0) return "existing";
      await tx.itemDocumentPage.createMany({
        data: pages.map((page, position) => ({
          itemId,
          position,
          fileKey: page.fileKey,
          originalFileKey: page.fileKey,
          filter: "original" as const,
          width: page.width,
          height: page.height,
          ocrText: page.text,
        })),
      });
      const previous = isRecord(current.meta) ? current.meta : {};
      const pdfSize = typeof previous.size === "number" ? previous.size : 0;
      await tx.item.update({
        where: { id: itemId, userId },
        data: {
          fileKey: cover.fileKey,
          meta: {
            ...previous,
            // The displayed file is page 1's image; the PDF is sourceFileKey
            type: "image/jpeg",
            width: cover.width,
            height: cover.height,
            size: pdfSize + pageBytes,
            pageCount: pages.length,
          },
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { storageUsedBytes: { increment: pageBytes } },
      });
      return "saved" as const;
    });
    if (outcome !== "saved") await removeKeys(supabase, uploadedKeys);

    logger.log("PDF pages rendered", {
      itemId,
      outcome,
      pages: pages.length,
      pagesWithTextLayer: pages.filter((page) => page.text !== null).length,
      pageBytes,
    });
    return { outcome, pages: pages.length };
  } catch (error) {
    await removeKeys(supabase, uploadedKeys);
    throw error;
  } finally {
    pdf.close();
  }
}

type SavedPage = {
  fileKey: string;
  width: number;
  height: number;
  size: number;
  text: string | null;
};

/**
 * Render every page and upload its image, a few uploads overlapping the next
 * render. Keys are recorded in `uploadedKeys` before uploading, so the caller
 * can clean up after a failure part-way.
 */
async function renderPages({
  pdf,
  userId,
  supabase,
  uploadedKeys,
}: {
  pdf: Awaited<ReturnType<typeof openPdf>>;
  userId: string;
  supabase: SupabaseClient;
  uploadedKeys: string[];
}): Promise<SavedPage[]> {
  const pages: SavedPage[] = [];
  const inFlight = new Set<Promise<void>>();
  let uploadError: unknown = null;

  for (let index = 0; index < pdf.pageCount; index++) {
    if (uploadError) throw uploadError;
    const rendered = pdf.renderPage(index);
    const fileKey = `${userId}/${randomUUID()}.jpg`;
    uploadedKeys.push(fileKey);
    pages.push({
      fileKey,
      width: rendered.width,
      height: rendered.height,
      size: rendered.jpeg.byteLength,
      text: rendered.text,
    });

    const upload = supabase.storage
      .from("items")
      .upload(fileKey, rendered.jpeg, {
        contentType: "image/jpeg",
        upsert: false,
      })
      .then(({ error }) => {
        if (error) {
          throw new Error(
            `Failed to upload page ${index + 1}: ${formatStorageError(error)}`,
          );
        }
      })
      // Recorded rather than left to reject, so no upload rejects unhandled
      .catch((error: unknown) => {
        uploadError ??= error;
      })
      .finally(() => inFlight.delete(upload));
    inFlight.add(upload);
    if (inFlight.size >= UPLOAD_CONCURRENCY) await Promise.race(inFlight);
  }
  await Promise.all(inFlight);
  if (uploadError) throw uploadError;
  return pages;
}

/** Best-effort removal of page images from a failed or superseded attempt */
async function removeKeys(
  supabase: SupabaseClient,
  keys: string[],
): Promise<void> {
  if (keys.length === 0) return;
  const { error } = await supabase.storage.from("items").remove(keys);
  if (error) {
    logger.warn("Failed to remove page images from an unfinished import", {
      count: keys.length,
      error: formatStorageError(error),
    });
  }
}

/** Funnel events after `pdf_uploaded`; best-effort, never fails the import */
function captureImportEvent(
  userId: string,
  event: "pdf_imported" | "pdf_import_failed",
  properties: Record<string, unknown>,
): void {
  try {
    getPostHogClient()?.capture({ distinctId: userId, event, properties });
  } catch {
    // Analytics must never affect the import
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
