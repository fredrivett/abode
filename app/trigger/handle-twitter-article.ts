import { logger, tasks } from "@trigger.dev/sdk";
import db from "../src/lib/db";
import type { enrichItemTask } from "./enrich-item";

type HandleTwitterArticlePayload = {
  itemId: string;
  userId: string;
  url: string;
  articleId: string;
};

type HandleTwitterArticleResult = {
  success: true;
  itemId: string;
  kind: "article";
  twitterArticleId: string;
};

/**
 * Handle a Twitter/X Article URL.
 * Twitter Articles cannot be fetched programmatically (returns 403/500),
 * so we store them with minimal metadata as an article type.
 */
export async function handleTwitterArticle(
  payload: HandleTwitterArticlePayload,
): Promise<HandleTwitterArticleResult> {
  const { itemId, userId, url, articleId } = payload;

  logger.log("Processing Twitter Article", { itemId, url, articleId });

  // Extract domain from URL
  let domain = "x.com";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // Use default
  }

  // Update item as an article with Twitter Article metadata
  // We can't fetch the actual content due to Twitter's restrictions,
  // but we can store the URL and basic info
  await db.item.update({
    where: { id: itemId, userId },
    data: {
      kind: "article",
      title: "Twitter Article",
      description: "Twitter Article (content not available for preview)",
      meta: {
        twitterArticleId: articleId,
        originalUrl: url,
      },
    },
  });

  // Upsert article details record with minimal info (idempotent for retries)
  const articleDetailsData = {
    domain,
    content: null,
    readingTime: null,
    author: null,
    publishedAt: null,
  };
  await db.itemArticleDetails.upsert({
    where: { itemId },
    create: { itemId, ...articleDetailsData },
    update: articleDetailsData,
  });

  logger.log("Twitter Article saved", { itemId, articleId });

  // Trigger enrichment (room sync — no content available for tags/embedding)
  logger.log("Triggering item enrichment", { itemId, userId });
  await tasks.trigger<typeof enrichItemTask>("enrich-item", {
    itemId,
    userId,
  });

  return {
    success: true,
    itemId,
    kind: "article",
    twitterArticleId: articleId,
  };
}
