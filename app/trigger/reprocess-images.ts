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
      return { total: 0, triggered: 0 };
    }

    const batchItems = items.map((item) => ({
      payload: {
        itemId: item.id,
        userId: item.userId,
        fileKey: item.fileKey as string,
      },
    }));

    await tasks.batchTrigger<typeof analyzeImageTask>(
      "analyze-image",
      batchItems,
    );

    logger.info(`Triggered ${items.length} image analysis tasks`);

    return {
      total: items.length,
      triggered: items.length,
    };
  },
});
