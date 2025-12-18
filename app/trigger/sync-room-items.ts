/**
 * Background task to re-sync all items for a room.
 *
 * Triggered when room filters are updated to re-evaluate which items belong.
 */

import { logger, task } from "@trigger.dev/sdk";
import { syncRoomItems } from "../src/lib/rooms";

type SyncRoomItemsPayload = {
  roomId: string;
  userId: string;
};

export const syncRoomItemsTask = task({
  id: "sync-room-items",
  maxDuration: 300, // 5 minutes for large item sets
  run: async (payload: SyncRoomItemsPayload) => {
    const { roomId, userId } = payload;

    logger.log("Starting room items sync", { roomId, userId });

    const result = await syncRoomItems(roomId, userId);

    logger.log("Room items sync complete", {
      roomId,
      userId,
      added: result.added,
      removed: result.removed,
    });

    return {
      success: true,
      roomId,
      userId,
      ...result,
    };
  },
});
