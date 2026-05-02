import { randomUUID } from "node:crypto";
import { Readability } from "@mozilla/readability";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { logger, task, tasks } from "@trigger.dev/sdk";
import { imageSize } from "image-size";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { truncateToTokenLimit } from "../src/lib/ai/generate-tags-from-content";
import db from "../src/lib/db";
import {
  extractAllProductImageCandidates,
  extractArticleMetadata,
  extractProductMetadata,
  extractTweetId,
  extractTwitterArticleId,
  extractVimeoVideoId,
  extractYouTubeVideoId,
  type ProductImageCandidate,
  type ProductMetadata,
  preserveSocialEmbeds,
} from "../src/lib/html-metadata";
import { selectProductImagesWithLLM } from "../src/lib/image-analysis/openai-product-image-filter";
import { detectPlatform } from "../src/lib/platforms";
import { captureServerException } from "../src/lib/posthog-server";
import { getExtensionFromContentType, isImageUrl } from "../src/lib/url-utils";
import type { analyzeImageTask } from "./analyze-image";
import type { enrichItemTask } from "./enrich-item";
import { handleTwitterArticle } from "./handle-twitter-article";
import { handleTwitterUrl } from "./handle-twitter-url";
import { handleVideoUrl } from "./handle-video-url";

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

/**
 * Downloads an image from a URL and stores it in Supabase storage.
 * Returns the file key, content type, and size for the caller to handle.
 */
async function downloadAndStoreImage(
  imageUrl: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<{
  fileKey: string;
  contentType: string;
  size: number;
  width: number;
  height: number;
} | null> {
  const fetched = await fetchImageBuffer(imageUrl);
  if (!fetched) return null;
  return uploadImageBuffer(fetched, userId, supabase);
}

async function fetchImageBuffer(imageUrl: string): Promise<{
  imageUrl: string;
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
} | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AbodeBot/1.0; +https://www.abode.fyi)",
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

    let width = 0;
    let height = 0;
    try {
      const dims = imageSize(buffer);
      width = dims.width ?? 0;
      height = dims.height ?? 0;
    } catch (err) {
      logger.warn("Failed to read image dimensions", { imageUrl, err });
    }

    return { imageUrl, buffer, contentType, width, height };
  } catch (error) {
    logger.error("Error downloading image", { imageUrl, error });
    return null;
  }
}

async function uploadImageBuffer(
  fetched: {
    imageUrl: string;
    buffer: Buffer;
    contentType: string;
    width: number;
    height: number;
  },
  userId: string,
  supabase: SupabaseClient,
): Promise<{
  fileKey: string;
  contentType: string;
  size: number;
  width: number;
  height: number;
} | null> {
  const ext = getExtensionFromContentType(fetched.contentType);
  const fileKey = `${userId}/${randomUUID()}${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("items")
    .upload(fileKey, fetched.buffer, {
      contentType: fetched.contentType,
      upsert: false,
    });

  if (uploadError) {
    logger.error("Failed to upload image to storage", {
      imageUrl: fetched.imageUrl,
      error: uploadError,
    });
    return null;
  }

  return {
    fileKey,
    contentType: fetched.contentType,
    size: fetched.buffer.length,
    width: fetched.width,
    height: fetched.height,
  };
}

/**
 * Classifies a URL into a content type (tweet, article, image, video) and
 * processes it accordingly.
 *
 * Resolves short URLs, delegates to specialised handlers for Twitter/YouTube/
 * Vimeo/direct images, and falls back to article extraction via Readability.
 * Marks the item as `failed` on error.
 */
export const classifyUrlTask = task({
  id: "classify-url",
  maxDuration: 120, // 2 minutes should be plenty for fetching and classifying
  run: async (payload: ClassifyUrlPayload) => {
    const { itemId, userId, url } = payload;

    const { url: supabaseUrl, key: supabaseKey } = getSupabaseConfig();
    const supabase = createClient(supabaseUrl, supabaseKey);

    logger.log("Starting URL classification", { itemId, userId, url });

    try {
      // Step 0: Check if this is a Twitter/X URL before any fetching
      // For short URLs (like t.co), we need to resolve them first to get the actual destination
      let resolvedUrl = url;
      const platform = detectPlatform(url);

      if (platform === "twitter") {
        let twitterUrl = url;

        // If t.co short URL, resolve it first to get the destination
        if (new URL(url).hostname === "t.co") {
          logger.log("Resolving t.co short URL", { itemId, url });
          try {
            // Use a simple User-Agent for t.co resolution.
            // With browser-like User-Agents, t.co returns a JavaScript redirect instead of HTTP redirect,
            // which Node.js fetch can't follow. Simple User-Agents get proper HTTP 301/302 redirects.
            const resolveResponse = await fetch(url, {
              method: "HEAD",
              redirect: "follow",
              headers: {
                "User-Agent": "AbodeBot/1.0",
              },
            });
            twitterUrl = resolveResponse.url;
            resolvedUrl = twitterUrl;
            logger.log("Resolved t.co URL", {
              itemId,
              originalUrl: url,
              resolvedUrl: twitterUrl,
            });
          } catch (resolveError) {
            logger.warn(
              "Failed to resolve t.co URL, will try fetching directly",
              { itemId, url, error: resolveError },
            );
          }
        }

        // Check if it's a tweet
        const tweetId = extractTweetId(twitterUrl);
        if (tweetId) {
          logger.log("URL classified as Twitter/X post", {
            itemId,
            url: twitterUrl,
            tweetId,
          });
          return await handleTwitterUrl({
            itemId,
            userId,
            url: twitterUrl,
            tweetId,
          });
        }

        // Check if it's a Twitter Article
        const articleId = extractTwitterArticleId(twitterUrl);
        if (articleId) {
          logger.log("URL classified as Twitter Article", {
            itemId,
            url: twitterUrl,
            articleId,
          });
          return await handleTwitterArticle({
            itemId,
            userId,
            url: twitterUrl,
            articleId,
          });
        }

        // Twitter URL without tweet/article ID (could be a profile or other page)
        logger.warn("Twitter URL without tweet ID, treating as article", {
          itemId,
          url: twitterUrl,
        });
      }

      // Check for YouTube video
      const youtubeVideoId = extractYouTubeVideoId(resolvedUrl);
      if (youtubeVideoId) {
        logger.log("URL classified as YouTube video", {
          itemId,
          url: resolvedUrl,
          videoId: youtubeVideoId,
        });
        return await handleVideoUrl(
          {
            itemId,
            userId,
            url: resolvedUrl,
            platform: "youtube",
            videoId: youtubeVideoId,
          },
          supabase,
        );
      }

      // Check for Vimeo video
      const vimeoVideoId = extractVimeoVideoId(resolvedUrl);
      if (vimeoVideoId) {
        logger.log("URL classified as Vimeo video", {
          itemId,
          url: resolvedUrl,
          videoId: vimeoVideoId,
        });
        return await handleVideoUrl(
          {
            itemId,
            userId,
            url: resolvedUrl,
            platform: "vimeo",
            videoId: vimeoVideoId,
          },
          supabase,
        );
      }

      // Use resolvedUrl for all subsequent operations (may differ from original if t.co was resolved)
      const fetchUrl = resolvedUrl;

      // Step 1: Fetch the URL with a HEAD request first to check content type
      logger.log("Checking URL content type", { itemId, url: fetchUrl });

      let contentType: string | null = null;
      try {
        const headResponse = await fetch(fetchUrl, {
          method: "HEAD",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; AbodeBot/1.0; +https://www.abode.fyi)",
          },
        });
        contentType = headResponse.headers.get("content-type");
      } catch {
        logger.log("HEAD request failed, will try GET", {
          itemId,
          url: fetchUrl,
        });
      }

      // Check if it's a direct image URL
      if (isImageUrl(fetchUrl, contentType ?? undefined)) {
        logger.log("URL classified as direct image", { itemId, url: fetchUrl });
        return await handleImageUrl(itemId, userId, fetchUrl, supabase);
      }

      // Step 2: Fetch the full page content
      logger.log("Fetching page content", { itemId, url: fetchUrl });

      const response = await fetch(fetchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; AbodeBot/1.0; +https://www.abode.fyi)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status}`);
      }

      const finalContentType = response.headers.get("content-type");

      // Double-check if it's actually an image (some servers don't respond to HEAD)
      if (isImageUrl(fetchUrl, finalContentType ?? undefined)) {
        logger.log("URL classified as image after GET", {
          itemId,
          url: fetchUrl,
        });
        return await handleImageUrl(itemId, userId, fetchUrl, supabase);
      }

      // Step 3: Parse HTML and check for product before article
      const html = await response.text();

      // Step 3a: Check if this is a product page
      const productMeta = extractProductMetadata(html, fetchUrl);
      if (productMeta) {
        const candidates = extractAllProductImageCandidates(html, fetchUrl);
        logger.log("URL classified as product", {
          itemId,
          url: fetchUrl,
          title: productMeta.title,
          brand: productMeta.brand,
          price: productMeta.price,
          candidateCount: candidates.length,
        });
        return await handleProductUrl(
          itemId,
          userId,
          productMeta,
          candidates,
          supabase,
        );
      }

      const metadata = extractArticleMetadata(html, fetchUrl);

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

        const dom = new JSDOM(processedHtml, { url: fetchUrl });
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
      let coverResult: { fileKey: string; size: number } | null = null;
      if (metadata.ogImage) {
        logger.log("Downloading cover image", {
          itemId,
          ogImage: metadata.ogImage,
        });

        const result = await downloadAndStoreImage(
          metadata.ogImage,
          userId,
          supabase,
        );

        if (result) {
          coverResult = { fileKey: result.fileKey, size: result.size };
          logger.log("Cover image stored", {
            itemId,
            coverFileKey: result.fileKey,
          });
        }
      }

      // Step 5: Update item with article data and track cover image storage
      await db.$transaction(async (tx) => {
        await tx.item.update({
          where: { id: itemId, userId },
          data: {
            kind: "article",
            title: metadata.title,
            description: metadata.description,
            ...(coverResult && { coverFileKey: coverResult.fileKey }),
            meta: {
              originalName: metadata.title,
              ...(coverResult && { coverSize: coverResult.size }),
            },
          },
        });

        // Update storage accounting for cover image
        if (coverResult && coverResult.size > 0) {
          await tx.user.update({
            where: { id: userId },
            data: { storageUsedBytes: { increment: BigInt(coverResult.size) } },
          });
        }
      });

      // Step 6: Upsert article details record (idempotent for retries)
      const articleDetailsData = {
        author: metadata.author,
        domain: metadata.domain,
        publishedAt: metadata.publishedAt,
        readingTime,
        content: articleContent,
      };
      await db.itemArticleDetails.upsert({
        where: { itemId },
        create: { itemId, ...articleDetailsData },
        update: articleDetailsData,
      });

      logger.log("Article processing complete", { itemId });

      // Step 7: Trigger enrichment (tags, text embedding, room sync)
      const sourceText =
        articleContent ??
        [metadata.title, metadata.description].filter(Boolean).join(" ");

      logger.log("Triggering item enrichment", { itemId, userId });
      await tasks.trigger<typeof enrichItemTask>("enrich-item", {
        itemId,
        userId,
        sourceText: truncateToTokenLimit(sourceText, 8191),
      });

      return {
        success: true,
        itemId,
        kind: "article" as const,
        metadata: {
          title: metadata.title,
          domain: metadata.domain,
          hasCover: !!coverResult,
        },
      };
    } catch (error) {
      logger.error("URL classification failed", { itemId, error });
      captureServerException(error, userId, {
        task: "classify-url",
        itemId,
        url,
      });

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

  // Update item with image data and track storage
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

    // Update storage accounting
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

const MAX_PRODUCT_IMAGES = 8;
const DOWNLOAD_BUDGET = 20;

const SOURCE_RANK: Record<ProductImageCandidate["source"], number> = {
  "json-ld": 0,
  og: 1,
  dom: 2,
};

async function handleProductUrl(
  itemId: string,
  userId: string,
  productMeta: ProductMetadata,
  candidates: ProductImageCandidate[],
  supabase: SupabaseClient,
) {
  let pickedCandidates: ProductImageCandidate[] = candidates;
  if (candidates.length > 1) {
    const keptIndices = await selectProductImagesWithLLM({
      imageUrls: candidates.map((c) => c.url),
      productTitle: productMeta.title,
      domain: productMeta.domain,
    });
    pickedCandidates = keptIndices.map((i) => candidates[i]);
  }

  const toFetch = pickedCandidates.slice(0, DOWNLOAD_BUDGET);

  const fetched = await Promise.all(
    toFetch.map(async (candidate) => {
      const result = await fetchImageBuffer(candidate.url);
      return result ? { ...result, source: candidate.source } : null;
    }),
  );

  type FetchedCandidate = NonNullable<(typeof fetched)[number]>;
  const fetchedNonNull = fetched.filter(
    (r): r is FetchedCandidate => r !== null,
  );

  // Order: source priority first (json-ld > og > dom), then largest dim desc
  fetchedNonNull.sort((a, b) => {
    const rankDiff = SOURCE_RANK[a.source] - SOURCE_RANK[b.source];
    if (rankDiff !== 0) return rankDiff;
    return Math.max(b.width, b.height) - Math.max(a.width, a.height);
  });

  const toStore = fetchedNonNull.slice(0, MAX_PRODUCT_IMAGES);

  const uploaded = await Promise.all(
    toStore.map(async (item) => {
      const result = await uploadImageBuffer(item, userId, supabase);
      return result ? { ...result, url: item.imageUrl } : null;
    }),
  );

  const storedImages = uploaded.filter(
    (
      r,
    ): r is {
      fileKey: string;
      contentType: string;
      size: number;
      width: number;
      height: number;
      url: string;
    } => r !== null,
  );

  const coverFileKey = storedImages[0]?.fileKey ?? null;
  const totalImageSize = storedImages.reduce((sum, img) => sum + img.size, 0);

  await db.$transaction(async (tx) => {
    await tx.item.update({
      where: { id: itemId, userId },
      data: {
        kind: "product",
        title: productMeta.title,
        description: productMeta.description,
        ...(coverFileKey && { coverFileKey }),
        meta: {
          originalName: productMeta.title,
          ...(totalImageSize > 0 && { coverSize: storedImages[0]?.size }),
        },
      },
    });

    if (totalImageSize > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { storageUsedBytes: { increment: BigInt(totalImageSize) } },
      });
    }
  });

  const productDetailsData = {
    domain: productMeta.domain,
    brand: productMeta.brand,
    price: productMeta.price,
    currency: productMeta.currency,
    availability: productMeta.availability,
    images: storedImages.map(({ fileKey, url, width, height }) => ({
      fileKey,
      url,
      ...(width > 0 && { width }),
      ...(height > 0 && { height }),
    })),
  };
  await db.itemProductDetails.upsert({
    where: { itemId },
    create: { itemId, ...productDetailsData },
    update: productDetailsData,
  });

  logger.log("Product processing complete, triggering enrichment", {
    itemId,
    imageCount: storedImages.length,
  });

  const sourceText = [
    productMeta.title,
    productMeta.description,
    productMeta.brand,
  ]
    .filter(Boolean)
    .join(" ");

  await tasks.trigger<typeof enrichItemTask>("enrich-item", {
    itemId,
    userId,
    sourceText: truncateToTokenLimit(sourceText, 8191),
  });

  // Trigger image analysis on cover image for visual tagging and search
  if (coverFileKey) {
    await tasks.trigger<typeof analyzeImageTask>("analyze-image", {
      itemId,
      userId,
      fileKey: coverFileKey,
    });
  }

  return {
    success: true,
    itemId,
    kind: "product" as const,
    metadata: {
      title: productMeta.title,
      domain: productMeta.domain,
      price: productMeta.price,
      brand: productMeta.brand,
      imageCount: storedImages.length,
    },
  };
}
