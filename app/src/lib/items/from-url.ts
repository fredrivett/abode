import type { classifyUrlTask } from "@app/trigger/classify-url";
import { tasks } from "@trigger.dev/sdk";
import db from "@/lib/db";
import { provisionalUrlAspect } from "@/lib/items/provisional-aspect";
import { createLogger } from "@/lib/logger.server";
import { markMilestoneComplete } from "@/lib/milestones";
import { getPostHogClient } from "@/lib/posthog-server";

const log = createLogger("lib/items/from-url");

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
}: {
  userId: string;
  url: string;
  source: ItemSource;
}) {
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
    await tasks.trigger<typeof classifyUrlTask>(
      "classify-url",
      {
        itemId: item.id,
        userId,
        url: parsedUrl.href,
      },
      { concurrencyKey: userId },
    );
  } catch (error) {
    // Mark failed so the UI surfaces a Retry instead of spinning forever.
    // Best-effort: the item is already persisted, so a failure here must not
    // fail the save (which would error after a successful insert).
    log.warn({ error, itemId: item.id }, "Failed to trigger classify-url");
    try {
      await db.item.update({
        where: { id: item.id },
        data: { processingStatus: "failed" },
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
    },
  });

  void markMilestoneComplete(userId, "save_first_url");

  return item;
}
