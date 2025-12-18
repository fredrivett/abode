/**
 * Background task to sync an item to all of a user's smart rooms.
 *
 * Triggered after item processing completes (analyze-image, classify-url)
 * or when filter-relevant fields are updated.
 */

import { logger, task } from "@trigger.dev/sdk";
import { syncItemToRooms } from "../src/lib/rooms";

type SyncItemToRoomsPayload = {
  itemId: string;
  userId: string;
};

export const syncItemToRoomsTask = task({
  id: "sync-item-to-rooms",
  maxDuration: 60, // 1 minute should be plenty
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
  },
  run: async (payload: SyncItemToRoomsPayload) => {
    const { itemId, userId } = payload;

    logger.log("Starting item-to-rooms sync", { itemId, userId });

    const result = await syncItemToRooms(itemId, userId);

    logger.log("Item-to-rooms sync complete", {
      itemId,
      userId,
      added: result.added,
      removed: result.removed,
    });

    return {
      success: true,
      itemId,
      userId,
      ...result,
    };
  },
});
