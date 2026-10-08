import { recordAiUsage } from "../ai-costs/record-ai-usage";
import { isOpenAiConfigured } from "../embeddings";
import { transcribeDocumentWithOpenAI } from "../image-analysis/openai-vision";
import { createLogger } from "../logger.server";
import { captureServerException } from "../posthog-server";
import { detectDocumentText, isGoogleVisionConfigured } from "../vision";

const log = createLogger("lib/documents/document-ocr");

export type DocumentOcrEngine = "google_vision" | "openai";

export type DocumentOcrResult =
  | { text: string; engine: DocumentOcrEngine }
  /** No OCR service configured, or every configured one failed */
  | { text: null; engine: null };

export { MAX_OCR_PAGES_PER_DOCUMENT } from "./document-pages";

/** Whether any service that can read document pages is configured */
export function isDocumentOcrConfigured(): boolean {
  return isGoogleVisionConfigured() || isOpenAiConfigured();
}

/**
 * Full text of one scanned page. Prefers Google Vision's dense-document OCR
 * (cheap, built for pages); falls back to an OpenAI vision transcription if
 * Google isn't configured or errors. Both are optional: with neither, or if
 * both fail, returns `{ text: null }` so the page is saved without text rather
 * than failing the document.
 */
export async function extractPageText({
  buffer,
  mimeType,
  userId,
  itemId,
}: {
  buffer: Buffer;
  mimeType: string;
  userId: string;
  itemId: string;
}): Promise<DocumentOcrResult> {
  if (isGoogleVisionConfigured()) {
    try {
      const text = await detectDocumentText(buffer);
      recordAiUsage({
        userId,
        itemId,
        itemKind: "document",
        provider: "google_vision",
        operation: "document_ocr",
        model: "DOCUMENT_TEXT_DETECTION",
        images: 1,
      });
      return { text, engine: "google_vision" };
    } catch (error) {
      log.warn({ error, itemId }, "Google Vision OCR failed — trying OpenAI");
      captureServerException(error, userId, {
        source: "document-ocr:google",
        itemId,
      });
    }
  }

  if (isOpenAiConfigured()) {
    try {
      const result = await transcribeDocumentWithOpenAI(buffer, mimeType);
      recordAiUsage({
        userId,
        itemId,
        itemKind: "document",
        provider: "openai",
        operation: "document_ocr",
        model: result.model,
        inputTokens: result.usage.promptTokens,
        outputTokens: result.usage.completionTokens,
      });
      return { text: result.text, engine: "openai" };
    } catch (error) {
      log.warn({ error, itemId }, "OpenAI document OCR failed");
      captureServerException(error, userId, {
        source: "document-ocr:openai",
        itemId,
      });
    }
  } else if (!isGoogleVisionConfigured()) {
    log.info(
      { itemId },
      "No OCR service configured — saving page without text",
    );
  }

  return { text: null, engine: null };
}
