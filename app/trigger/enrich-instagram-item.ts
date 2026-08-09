import { createClient } from "@supabase/supabase-js";
import { task } from "@trigger.dev/sdk";
import db from "../src/lib/db";
import { markProcessingActive } from "../src/lib/items/mark-processing-active";
import { captureServerException } from "../src/lib/posthog-server";
import type { InstagramDetails } from "../src/lib/types/item";
import { getSupabaseConfig } from "./analyze-image";
import { persistInstagramItem } from "./persist-instagram-item";

type EnrichInstagramItemPayload = {
  itemId: string;
  userId: string;
  /** The item's source URL, for the external-links entry. */
  url: string;
  /** Full details scraped by the extension; media has no fileKeys yet. */
  details: InstagramDetails;
  /**
   * Terminal status if every retry fails. An enrich of an existing item leaves
   * the basic capture intact (`completed`, default); a fresh direct-save has no
   * prior capture, so it should surface a retry (`failed`).
   */
  restoreStatusOnFailure?: "completed" | "failed";
};

/**
 * Upgrade an Instagram item to `full` capture from media the browser extension
 * scraped off the logged-in post page. Re-hosts every carousel image and
 * replaces the item's details.
 *
 * Runs against an already-`completed` (basic) item, so on failure the item is
 * left intact — never marked failed — since the basic capture is still valid.
 */
export const enrichInstagramItemTask = task({
  id: "enrich-instagram-item",
  retry: { maxAttempts: 2 },
  maxDuration: 600,
  run: async (payload: EnrichInstagramItemPayload) => {
    const { itemId, userId, url, details } = payload;

    // Advance the reaper clock — this is a user-initiated processing run.
    await markProcessingActive(itemId);

    const { url: supabaseUrl, key } = getSupabaseConfig();
    const supabase = createClient(supabaseUrl, key);

    await persistInstagramItem(supabase, {
      itemId,
      userId,
      url,
      captureLevel: "full",
      details,
    });
    return { success: true, itemId };
  },
  // Runs only once all retries are exhausted. The basic capture is intact, so
  // release the route's claim (processing → completed) rather than stranding
  // the item. Holding the claim across intermediate retries is deliberate — it
  // stops a concurrent request enqueueing a second paid enrichment mid-retry.
  onFailure: async ({ payload, error }) => {
    captureServerException(error, payload.userId, {
      task: "enrich-instagram-item",
      itemId: payload.itemId,
    });
    await db.item
      .updateMany({
        where: {
          id: payload.itemId,
          userId: payload.userId,
          processingStatus: "processing",
        },
        data: {
          processingStatus: payload.restoreStatusOnFailure ?? "completed",
          ...(payload.restoreStatusOnFailure === "failed"
            ? { processingError: "unknown" }
            : {}),
        },
      })
      .catch(() => {});
  },
});
