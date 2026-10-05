import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger, tasks } from "@trigger.dev/sdk";
import db from "../src/lib/db";
import { titleFromFileName } from "../src/lib/documents/create-pdf-document-schema";
import { pdfFileNameFromUrl } from "../src/lib/documents/pdf-url";
import { SafeFetchError, safeFetch } from "../src/lib/http/safe-fetch";
import { pruneStaleItemDetails } from "../src/lib/item-details";
import {
  FetchError,
  ProcessingFailure,
} from "../src/lib/items/processing-error";
import { MAX_PDF_UPLOAD_BYTES, PDF_MIME_TYPE } from "../src/lib/uploads";
import { formatStorageError } from "./analyze-image";
import type { importPdfTask } from "./import-pdf";
import {
  deleteReplacedFiles,
  reclaimReplacedStorage,
} from "./reclaim-item-storage";

/** A 25MB PDF on a slow host takes far longer than a page's default ~10s */
const PDF_FETCH_TIMEOUT_MS = 60_000;

const isTooLarge = (error: unknown) =>
  error instanceof SafeFetchError && error.code === "body_too_large";

/**
 * Download the PDF a saved URL points at, through the SSRF gate and under the
 * upload size cap, and turn the item into a document holding it as its source
 * file. import-pdf then renders and analyses it like an uploaded PDF.
 */
export async function handlePdfUrl({
  itemId,
  userId,
  url,
  supabase,
}: {
  itemId: string;
  userId: string;
  url: string;
  supabase: SupabaseClient;
}) {
  logger.log("Processing as PDF URL", { itemId, url });

  let bytes: Uint8Array;
  let contentDisposition: string | null;
  try {
    const response = await safeFetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AbodeBot/1.0; +https://www.abode.fyi)",
        Accept: "application/pdf,*/*;q=0.8",
      },
      maxBytes: MAX_PDF_UPLOAD_BYTES,
      timeoutMs: PDF_FETCH_TIMEOUT_MS,
    });
    if (!response.ok) throw new FetchError(response.status, url);
    contentDisposition = response.headers.get("content-disposition");
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    if (isTooLarge(error)) {
      throw new ProcessingFailure(
        "document_too_long",
        `PDF at URL is over ${MAX_PDF_UPLOAD_BYTES} bytes`,
      );
    }
    throw error;
  }

  // A .pdf link can still answer with an HTML error or login page
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  if (!head.includes("%PDF-")) {
    throw new ProcessingFailure(
      "unsupported_content",
      "URL didn't return a PDF",
    );
  }

  const originalName = pdfFileNameFromUrl({ url, contentDisposition });
  const fileKey = `${userId}/${randomUUID()}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("items")
    .upload(fileKey, bytes, { contentType: PDF_MIME_TYPE, upsert: false });
  if (uploadError) {
    throw new Error(`Failed to store PDF: ${formatStorageError(uploadError)}`);
  }

  const replacedFileKeys = await db.$transaction(async (tx) => {
    // Reclaims the previous capture's files — for a PDF re-capture, its pages too
    const oldFileKeys = await reclaimReplacedStorage(tx, {
      itemId,
      userId,
      addedBytes: bytes.byteLength,
    });
    const { titleEditedByUser } = await tx.item.findUniqueOrThrow({
      where: { id: itemId },
      select: { titleEditedByUser: true },
    });
    await tx.item.update({
      where: { id: itemId, userId },
      data: {
        kind: "document",
        sourceFileKey: fileKey,
        // Page 1's image becomes the cover once import-pdf renders it
        fileKey: null,
        coverFileKey: null,
        faviconFileKey: null,
        // Named from its file until the import titles it from its text
        ...(titleEditedByUser
          ? {}
          : { title: titleFromFileName(originalName) }),
        meta: {
          originalName,
          size: bytes.byteLength,
          type: PDF_MIME_TYPE,
          originalUrl: url,
        },
      },
    });
    await pruneStaleItemDetails(tx, itemId, "document");
    return oldFileKeys;
  });

  await deleteReplacedFiles(supabase, replacedFileKeys, [fileKey]);

  await tasks.trigger<typeof importPdfTask>(
    "import-pdf",
    { itemId, userId },
    { concurrencyKey: userId },
  );

  logger.log("PDF URL stored, import triggered", {
    itemId,
    size: bytes.byteLength,
  });
  return { success: true, itemId, kind: "document" as const, fileKey };
}
