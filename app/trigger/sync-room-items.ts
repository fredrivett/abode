/**
 * Background task to re-sync all items for a room.
 *
 * Triggered when room filters are updated to re-evaluate which items belong.
 */

import { logger, task } from "@trigger.dev/sdk";
import { captureServerException } from "../src/lib/posthog-server";
import { syncRoomItems } from "../src/lib/rooms";

type SyncRoomItemsPayload = {
  roomId: string;
  userId: string;
  /** Optional: The item that triggered this sync (e.g., when item location was updated) */
  itemId?: string;
};

export const syncRoomItemsTask = task({
  id: "sync-room-items",
  maxDuration: 300, // 5 minutes for large item sets
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 60000,
  },
  run: async (payload: SyncRoomItemsPayload) => {
    const { roomId, userId, itemId } = payload;

    logger.log("Starting room items sync", { roomId, userId, itemId });

    try {
      const result = await syncRoomItems(roomId, userId);

      logger.log("Room items sync complete", {
        roomId,
        userId,
        itemId,
        addedItemIds: result.addedItemIds,
        removedItemIds: result.removedItemIds,
        added: result.added,
        removed: result.removed,
      });

      return {
        success: true,
        roomId,
        userId,
        itemId,
        ...result,
      };
    } catch (error) {
      logger.error("Room items sync failed", { roomId, userId, itemId, error });
      captureServerException(error, userId, {
        task: "sync-room-items",
        roomId,
        itemId,
      });
      throw error;
    }
  },
});
