import type { classifyUrlTask } from "@app/trigger/classify-url";
import db from "@/lib/db";
import { enqueueUserProcessing } from "@/lib/items/enqueue-user-processing";
import { provisionalUrlAspect } from "@/lib/items/provisional-aspect";
import { createLogger } from "@/lib/logger.server";
import { markMilestoneComplete } from "@/lib/milestones";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";

const log = createLogger("lib/items/from-url");

// Upper bound on extension-captured rendered HTML. Real pages run large; this
// caps what we hand downstream so a pathological page can't balloon processing.
const MAX_CAPTURED_HTML_CHARS = 5_000_000;

/**
 * Decides whether client-supplied HTML is a usable capture. A real capture is
 * `document.documentElement.outerHTML`, which is always a serialized document
 * starting with an <html> tag. Anything empty, oversized, or not a document is
 * ignored so classification falls back to the server-side fetch instead of
 * trusting a blank/garbage capture (see classify-url). Applied here — the shared
 * choke point for every caller — so no caller can slip an unvalidated capture
 * past `classifyUrlTask`.
 */
function usableCapturedHtml(html: string | undefined): string | undefined {
  if (html === undefined || html.length === 0) return undefined;
  if (html.length > MAX_CAPTURED_HTML_CHARS) {
    log.warn(
      { htmlLength: html.length },
      "Captured HTML over size cap; falling back to server fetch",
    );
    return undefined;
  }
  if (!/<html[\s/>]/i.test(html)) {
    log.warn("Captured HTML is not a document; falling back to server fetch");
    return undefined;
  }
  return html;
}

// Where the save originated, for analytics (default "web")
const VALID_ITEM_SOURCES = ["web", "share_target", "extension"] as const;
export type ItemSource = (typeof VALID_ITEM_SOURCES)[number];

export function isItemSource(value: unknown): value is ItemSource {
  return (
    typeof value === "string" &&
    VALID_ITEM_SOURCES.includes(value as ItemSource)
  );
}

/** Thrown when the provided URL is missing or not an http(s) URL. */
export class InvalidUrlError extends Error {}

/**
 * Persists a URL item for a user and enqueues background classification.
 *
 * Shared by the `/api/v1/items/from-url` route and the `/save` share target so
 * both paths behave identically. A classify-url enqueue failure marks the item
 * `failed` (surfacing a Retry in the UI) rather than failing the save — the
 * item is already persisted.
 *
 * @throws {InvalidUrlError} when `url` is not a valid http(s) URL.
 */
export async function createItemFromUrl({
  userId,
  url,
  source,
  html,
}: {
  userId: string;
  url: string;
  source: ItemSource;
  /**
   * The page's already-rendered DOM, captured client-side by the browser
   * extension. When present, classification uses it instead of a server-side
   * fetch (see classify-url). Optional — bare-URL saves omit it.
   */
  html?: string;
}) {
  const captured = usableCapturedHtml(html);

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    throw new InvalidUrlError("Invalid URL format");
  }

  // Seed a provisional aspect for URL-decidable kinds (video/twitter) so the
  // grid renders the processing card at its final shape and doesn't jump when
  // analysis completes. Unknowable kinds keep the grid's 4:3 default.
  const aspectHint = provisionalUrlAspect(parsedUrl.href);

  const item = await db.item.create({
    data: {
      kind: null,
      sourceType: "url",
      sourceUrl: parsedUrl.href,
      userId,
      processingStatus: "processing",
      ...(aspectHint ? { meta: { aspectHint } } : {}),
    },
    select: {
      id: true,
      userId: true,
      kind: true,
      processingStatus: true,
      sourceType: true,
      sourceUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // A queueing hiccup must not fail the save; the item is already persisted.
  try {
    await enqueueUserProcessing<typeof classifyUrlTask>(
      "classify-url",
      {
        itemId: item.id,
        userId,
        url: parsedUrl.href,
        ...(captured !== undefined ? { html: captured } : {}),
      },
      userId,
    );
  } catch (error) {
    // Mark failed so the UI surfaces a Retry instead of spinning forever.
    // Best-effort: the item is already persisted, so a failure here must not
    // fail the save (which would error after a successful insert).
    log.warn({ error, itemId: item.id }, "Failed to trigger classify-url");
    // Report it — the enqueue call throwing is the one failure mode with no
    // Trigger run to inspect afterwards, so without this we're blind to why.
    captureServerException(error, userId, {
      route: "createItemFromUrl",
      stage: "trigger:classify-url",
      itemId: item.id,
    });
    try {
      await db.item.update({
        where: { id: item.id },
        // Record a concrete reason so the failure reports as `enqueue_failed`
        // rather than a null the admin UI has to paper over.
        data: { processingStatus: "failed", processingError: "enqueue_failed" },
      });
    } catch (updateError) {
      log.error(
        { updateError, itemId: item.id },
        "Failed to mark item failed after classify-url enqueue error",
      );
    }
  }

  getPostHogClient()?.capture({
    distinctId: userId,
    event: "item_imported_from_url",
    properties: {
      item_id: item.id,
      url_domain: parsedUrl.hostname,
      source,
      captured_html: captured !== undefined,
    },
  });

  void markMilestoneComplete(userId, "save_first_url");

  return item;
}
