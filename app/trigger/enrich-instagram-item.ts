import { createClient } from "@supabase/supabase-js";
import { task } from "@trigger.dev/sdk";
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

    try {
      await persistInstagramItem(supabase, {
        itemId,
        userId,
        url,
        captureLevel: "full",
        details,
      });
      return { success: true, itemId };
    } catch (error) {
      captureServerException(error, userId, {
        task: "enrich-instagram-item",
        itemId,
      });
      throw error;
    }
  },
});
