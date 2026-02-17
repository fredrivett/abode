import { logger, task, tasks } from "@trigger.dev/sdk";
import db from "../src/lib/db";
import type { analyzeImageTask } from "./analyze-image";

export const reprocessImagesTask = task({
  id: "reprocess-images",
  retry: {
    maxAttempts: 1,
  },
  run: async () => {
    const items = await db.item.findMany({
      where: {
        kind: "image",
        fileKey: { not: null },
      },
      select: {
        id: true,
        userId: true,
        fileKey: true,
      },
    });

    logger.info(`Found ${items.length} images to reprocess`);

    if (items.length === 0) {
      return { total: 0, triggered: 0, skipped: 0 };
    }

    const batchItems: {
      payload: { itemId: string; userId: string; fileKey: string };
    }[] = [];
    let skipped = 0;

    for (const item of items) {
      if (!item.fileKey) {
        logger.warn("Skipping image item with null fileKey", {
          itemId: item.id,
        });
        skipped++;
        continue;
      }

      batchItems.push({
        payload: {
          itemId: item.id,
          userId: item.userId,
          fileKey: item.fileKey,
        },
      });
    }

    if (skipped > 0) {
      logger.warn(`Skipped ${skipped} items with null fileKey`);
    }

    if (batchItems.length > 0) {
      await tasks.batchTrigger<typeof analyzeImageTask>(
        "analyze-image",
        batchItems,
      );
    }

    logger.info(`Triggered ${batchItems.length} image analysis tasks`);

    return {
      total: items.length,
      triggered: batchItems.length,
      skipped,
    };
  },
});
