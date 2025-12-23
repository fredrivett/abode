import { randomUUID } from "node:crypto";
import { Readability } from "@mozilla/readability";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { logger, task, tasks } from "@trigger.dev/sdk";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import db from "../src/lib/db";
import {
  extractArticleMetadata,
  preserveSocialEmbeds,
} from "../src/lib/html-metadata";
import { getExtensionFromContentType, isImageUrl } from "../src/lib/url-utils";
import type { analyzeImageTask } from "./analyze-image";
import type { syncItemToRoomsTask } from "./sync-item-to-rooms";

type ClassifyUrlPayload = {
  itemId: string;
  userId: string;
  url: string;
};

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL for classify-url",
    );
  }

  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for classify-url");
  }

  return { url, key };
}

async function downloadAndStoreImage(
  imageUrl: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<{ fileKey: string; contentType: string; size: number } | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AbodeBot/1.0; +https://abode.dev)",
      },
    });

    if (!response.ok) {
      logger.warn("Failed to download image", {
        imageUrl,
        status: response.status,
      });
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await response.arrayBuffer());

    const ext = getExtensionFromContentType(contentType);
    const fileKey = `${userId}/${randomUUID()}${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("items")
      .upload(fileKey, buffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      logger.error("Failed to upload image to storage", {
        imageUrl,
        error: uploadError,
      });
      return null;
    }

    return { fileKey, contentType, size: buffer.length };
  } catch (error) {
    logger.error("Error downloading/storing image", { imageUrl, error });
    return null;
  }
}

export const classifyUrlTask = task({
  id: "classify-url",
  maxDuration: 120, // 2 minutes should be plenty for fetching and classifying
  run: async (payload: ClassifyUrlPayload) => {
    const { itemId, userId, url } = payload;

    const { url: supabaseUrl, key: supabaseKey } = getSupabaseConfig();
    const supabase = createClient(supabaseUrl, supabaseKey);

    logger.log("Starting URL classification", { itemId, userId, url });

    try {
      // Step 1: Fetch the URL with a HEAD request first to check content type
      logger.log("Checking URL content type", { itemId, url });

      let contentType: string | null = null;
      try {
        const headResponse = await fetch(url, {
          method: "HEAD",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; AbodeBot/1.0; +https://abode.dev)",
          },
        });
        contentType = headResponse.headers.get("content-type");
      } catch {
        logger.log("HEAD request failed, will try GET", { itemId, url });
      }

      // Check if it's a direct image URL
      if (isImageUrl(url, contentType ?? undefined)) {
        logger.log("URL classified as direct image", { itemId, url });
        return await handleImageUrl(itemId, userId, url, supabase);
      }

      // Step 2: Fetch the full page content
      logger.log("Fetching page content", { itemId, url });

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; AbodeBot/1.0; +https://abode.dev)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status}`);
      }

      const finalContentType = response.headers.get("content-type");

      // Double-check if it's actually an image (some servers don't respond to HEAD)
      if (isImageUrl(url, finalContentType ?? undefined)) {
        logger.log("URL classified as image after GET", { itemId, url });
        return await handleImageUrl(itemId, userId, url, supabase);
      }

      // Step 3: Parse as article
      const html = await response.text();
      const metadata = extractArticleMetadata(html, url);

      // Step 3.5: Extract article content using Mozilla Readability
      // Readability is battle-tested (powers Firefox Reader View) and produces
      // clean article content without navigation, footers, or other page chrome.
      let articleContent: string | null = null;
      let readingTime: number | null = null;

      try {
        // Pre-process HTML: Remove hidden attribute from divs
        // Modern React/Next.js sites use streaming SSR which renders content into
        // hidden divs that are revealed via JavaScript hydration. Readability
        // ignores hidden elements, so we need to unhide them first.
        let processedHtml = html.replace(
          /<div([^>]*)\s+hidden([^>]*)>/gi,
          "<div$1$2>",
        );

        // Pre-process HTML: Preserve social media embeds before Readability runs
        // Twitter/X embeds are blockquotes that would be stripped of their structure.
        // We replace them with placeholder divs containing the tweet URL, then convert
        // these to markdown markers after Readability extracts the content.
        const embedResult = preserveSocialEmbeds(processedHtml);
        processedHtml = embedResult.html;

        if (embedResult.tweetIds.length > 0) {
          logger.log("Twitter embeds detected and preserved", {
            itemId,
            tweetCount: embedResult.tweetIds.length,
            tweetIds: embedResult.tweetIds,
          });
        } else {
          logger.log("No Twitter embeds found in article HTML", { itemId });
        }

        const dom = new JSDOM(processedHtml, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();

        if (article?.content) {
          // Convert HTML to markdown for consistent storage and rendering
          const turndown = new TurndownService({
            headingStyle: "atx",
            codeBlockStyle: "fenced",
          });
          // Preserve SVG elements as raw HTML in markdown output
          // This allows inline SVGs (like logos, icons, charts) to render properly
          // Cast needed because Turndown types only include HTMLElementTagNameMap, not SVG
          turndown.keep(["svg"] as unknown as (keyof HTMLElementTagNameMap)[]);
          articleContent = turndown.turndown(article.content);
          const wordCount = articleContent.split(/\s+/).length;
          if (wordCount > 0) {
            readingTime = Math.ceil(wordCount / 200);
          }

          // Check if tweet markers survived the Readability + Turndown pipeline
          const tweetMarkerMatches = articleContent.match(/\[\[TWEET:\d+\]\]/g);
          const preservedTweetCount = tweetMarkerMatches?.length ?? 0;

          logger.log("Content extracted with Readability", {
            itemId,
            contentLength: articleContent.length,
            wordCount,
            preservedTweetMarkers: preservedTweetCount,
            tweetMarkersFound: tweetMarkerMatches ?? [],
          });

          if (
            embedResult.tweetIds.length > 0 &&
            preservedTweetCount !== embedResult.tweetIds.length
          ) {
            logger.warn("Tweet markers may have been lost during processing", {
              itemId,
              originalTweetCount: embedResult.tweetIds.length,
              preservedTweetCount,
              originalTweetIds: embedResult.tweetIds,
            });
          }
        }
      } catch (readabilityError) {
        logger.warn("Failed to extract article content", {
          itemId,
          error: readabilityError,
        });
      }

      logger.log("Article content extraction result", {
        itemId,
        contentExtracted: !!articleContent,
        contentLength: articleContent?.length ?? 0,
        readingTime,
      });

      logger.log("URL classified as article", {
        itemId,
        url,
        title: metadata.title,
        domain: metadata.domain,
        hasOgImage: !!metadata.ogImage,
        hasContent: !!articleContent,
      });

      // Step 4: Download cover image if available
      let coverFileKey: string | null = null;
      if (metadata.ogImage) {
        logger.log("Downloading cover image", {
          itemId,
          ogImage: metadata.ogImage,
        });

        const coverResult = await downloadAndStoreImage(
          metadata.ogImage,
          userId,
          supabase,
        );

        if (coverResult) {
          coverFileKey = coverResult.fileKey;
          logger.log("Cover image stored", { itemId, coverFileKey });
        }
      }

      // Step 5: Update item with article data
      // Store original extracted title in meta.originalName for reference
      await db.item.update({
        where: { id: itemId, userId },
        data: {
          kind: "article",
          title: metadata.title,
          description: metadata.description,
          coverFileKey,
          processingStatus: "completed",
          meta: {
            originalName: metadata.title,
          },
        },
      });

      // Step 6: Create article details record
      await db.itemArticleDetails.create({
        data: {
          itemId,
          author: metadata.author,
          domain: metadata.domain,
          publishedAt: metadata.publishedAt,
          readingTime,
          content: articleContent,
        },
      });

      logger.log("Article processing complete", { itemId });

      // Step 7: Sync item to smart rooms
      logger.log("Triggering smart room sync", { itemId, userId });
      await tasks.trigger<typeof syncItemToRoomsTask>("sync-item-to-rooms", {
        itemId,
        userId,
      });

      return {
        success: true,
        itemId,
        kind: "article" as const,
        metadata: {
          title: metadata.title,
          domain: metadata.domain,
          hascover: !!coverFileKey,
        },
      };
    } catch (error) {
      logger.error("URL classification failed", { itemId, error });

      // Mark item as failed
      await db.item.update({
        where: { id: itemId, userId },
        data: { processingStatus: "failed" },
      });

      throw error;
    }
  },
});

async function handleImageUrl(
  itemId: string,
  userId: string,
  url: string,
  supabase: SupabaseClient,
) {
  logger.log("Processing as image URL", { itemId, url });

  // Download and store the image
  const imageResult = await downloadAndStoreImage(url, userId, supabase);

  if (!imageResult) {
    throw new Error("Failed to download image from URL");
  }

  // Update item with image data and increment user storage
  await db.$transaction(async (tx) => {
    await tx.item.update({
      where: { id: itemId, userId },
      data: {
        kind: "image",
        fileKey: imageResult.fileKey,
        meta: {
          size: imageResult.size,
          type: imageResult.contentType,
          originalUrl: url,
        },
      },
    });

    // Update user's storage usage
    if (imageResult.size > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { storageUsedBytes: { increment: BigInt(imageResult.size) } },
      });
    }
  });

  // Trigger image analysis
  await tasks.trigger<typeof analyzeImageTask>("analyze-image", {
    itemId,
    userId,
    fileKey: imageResult.fileKey,
  });

  logger.log("Image URL processing complete, analysis triggered", { itemId });

  return {
    success: true,
    itemId,
    kind: "image" as const,
    fileKey: imageResult.fileKey,
  };
}
