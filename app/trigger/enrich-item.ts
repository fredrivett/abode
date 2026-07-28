import { logger, task, tasks } from "@trigger.dev/sdk";
import {
  buildEmbeddingText,
  generateTagsFromText,
  truncateToTokenLimit,
} from "../src/lib/ai/generate-tags-from-content";
import { recordAiUsage } from "../src/lib/ai-costs/record-ai-usage";
import db from "../src/lib/db";
import { generateTextEmbedding, upsertTextVector } from "../src/lib/embeddings";
import { classifyFailureReason } from "../src/lib/items/processing-error";
import { captureServerException } from "../src/lib/posthog-server";
import type { syncItemToRoomsTask } from "./sync-item-to-rooms";

const EMBEDDING_TOKEN_LIMIT = 8191;

type EnrichItemPayload = {
  itemId: string;
  userId: string;
  precomputedTags?: string[];
  sourceText?: string;
};

export const enrichItemTask = task({
  id: "enrich-item",
  maxDuration: 120,
  run: async (payload: EnrichItemPayload) => {
    const { itemId, userId, precomputedTags, sourceText } = payload;

    logger.log("Starting item enrichment", { itemId, userId });

    try {
      let tags: string[] = [];

      if (precomputedTags) {
        tags = precomputedTags;
        logger.log("Using precomputed tags", { itemId, tagCount: tags.length });
      } else if (sourceText) {
        logger.log("Generating tags from source text", {
          itemId,
          sourceTextLength: sourceText.length,
        });
        tags = await generateTagsFromText(sourceText);
        logger.log("Tags generated", { itemId, tagCount: tags.length });
      } else {
        logger.log("No tags or source text provided, skipping tag generation", {
          itemId,
        });
      }

      // Update item with tags and mark as completed
      await db.item.update({
        where: { id: itemId, userId },
        data: {
          tags,
          processingStatus: "completed",
        },
      });

      logger.log("Item updated with tags and marked completed", {
        itemId,
        tagCount: tags.length,
      });

      // Build embedding text from tags + source text
      const rawEmbeddingText = buildEmbeddingText(tags, sourceText);

      if (rawEmbeddingText) {
        const embeddingInput = truncateToTokenLimit(
          rawEmbeddingText,
          EMBEDDING_TOKEN_LIMIT,
        );

        logger.log("Generating text embedding", {
          itemId,
          embeddingInputLength: embeddingInput.length,
        });

        const { embedding: textEmbedding, totalTokens } =
          await generateTextEmbedding(embeddingInput);

        // Record the billed embedding call before persistence — a failure of
        // the DB write below must not drop the cost of a request already made.
        recordAiUsage({
          userId,
          itemId,
          provider: "openai",
          operation: "text_embedding",
          model: "text-embedding-3-small",
          totalTokens,
          source: "ingestion",
        });

        const textVectorId = await upsertTextVector({
          itemId,
          userId,
          model: "text-embedding-3-small",
          embedding: textEmbedding,
        });

        logger.log("Text embedding stored", { itemId, textVectorId });
      } else {
        logger.log("No content for embedding, skipping", { itemId });
      }

      // Trigger smart room sync
      logger.log("Triggering smart room sync", { itemId, userId });
      await tasks.trigger<typeof syncItemToRoomsTask>("sync-item-to-rooms", {
        itemId,
        userId,
      });

      return {
        success: true,
        itemId,
        tagCount: tags.length,
      };
    } catch (error) {
      logger.error("Item enrichment failed", { itemId, error });
      captureServerException(error, userId, {
        task: "enrich-item",
        itemId,
      });

      // Only transition to failed if the item hasn't already completed — a
      // re-enrichment (e.g. cover re-analysis after a swap) must not regress a
      // completed item to failed.
      await db.item.updateMany({
        where: { id: itemId, userId, processingStatus: { not: "completed" } },
        data: {
          processingStatus: "failed",
          processingError: classifyFailureReason(error),
        },
      });

      throw error;
    }
  },
});
