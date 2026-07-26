import { randomUUID } from "node:crypto";
import { Readability } from "@mozilla/readability";
import type { ProcessingErrorReason } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { logger, task, tasks } from "@trigger.dev/sdk";
import { imageSize } from "image-size";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { truncateToTokenLimit } from "../src/lib/ai/generate-tags-from-content";
import { recordAiUsage } from "../src/lib/ai-costs/record-ai-usage";
import { classifyItemKind } from "../src/lib/classify-item-kind";
import db from "../src/lib/db";
import {
  type BookMetadata,
  extractAllProductImageCandidates,
  extractArticleMetadata,
  type ProductImageCandidate,
  type ProductMetadata,
  preserveSocialEmbeds,
} from "../src/lib/html-metadata";
import { selectProductImagesWithLLM } from "../src/lib/image-analysis/openai-product-image-filter";
import { pruneStaleItemDetails } from "../src/lib/item-details";
import type { ForcibleKind } from "../src/lib/item-kind-reassignment";
import {
  classifyFailureReason,
  FetchError,
  ProcessingFailure,
  reasonFromStatus,
} from "../src/lib/items/processing-error";
import { detectPlatform } from "../src/lib/platforms";
import { captureServerException } from "../src/lib/posthog-server";
import { getExtensionFromContentType } from "../src/lib/url-utils";
import type { analyzeImageTask } from "./analyze-image";
import type { enrichItemTask } from "./enrich-item";
import { handleTwitterArticle } from "./handle-twitter-article";
import { handleTwitterUrl } from "./handle-twitter-url";
import { handleVideoUrl } from "./handle-video-url";
import {
  deleteReplacedFiles,
  reclaimReplacedStorage,
} from "./reclaim-item-storage";

type ClassifyUrlPayload = {
  itemId: string;
  userId: string;
  url: string;
  /**
   * When set, the user is manually reassigning the item's kind: skip the
   * heuristic and re-run enrichment for this kind instead. Only web-family
   * kinds are forcible (see item-kind-reassignment).
   */
  forcedKind?: ForcibleKind;
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
type StoredImage = {
  fileKey: string;
  contentType: string;
  size: number;
  width: number;
  height: number;
};

type StoreImageResult =
  | ({ ok: true } & StoredImage)
  | { ok: false; reason: ProcessingErrorReason };

async function downloadAndStoreImage(
  imageUrl: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<StoreImageResult> {
  const fetched = await fetchImageBuffer(imageUrl);
  if (!fetched.ok) return fetched;
  const stored = await uploadImageBuffer(fetched, userId, supabase);
  // Upload to our own storage failed — infra issue, worth retrying
  if (!stored) return { ok: false, reason: "source_unreachable" };
  return { ok: true, ...stored };
}

type ImageBuffer = {
  imageUrl: string;
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
};

// Discriminated so callers that treat a failure as fatal (the direct-image
// path) can surface a precise reason, while cover-image callers still skip
// gracefully on `!ok`.
type ImageFetchResult =
  | ({ ok: true } & ImageBuffer)
  | { ok: false; reason: ProcessingErrorReason };

async function fetchImageBuffer(imageUrl: string): Promise<ImageFetchResult> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AbodeBot/1.0; +https://www.abode.fyi)",
      },
    });

    if (!response.ok) {
      logger.warn("Image fetch failed: bad status", {
        imageUrl,
        status: response.status,
      });
      return { ok: false, reason: reasonFromStatus(response.status) };
    }

    // Some sites (e.g. anti-bot pages) return 200 OK with an HTML error
    // body. Trust the Content-Type header and reject anything that isn't
    // declared as an image rather than uploading HTML/JSON as if it were.
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      logger.warn("Image fetch failed: non-image content-type", {
        imageUrl,
        contentType: contentType || "(none)",
      });
      return { ok: false, reason: "unsupported_content" };
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Final proof-of-image check: image-size only succeeds on a parseable
    // image header. If it throws, the bytes aren't a real image regardless
    // of what Content-Type claimed.
    let width = 0;
    let height = 0;
    try {
      const dims = imageSize(buffer);
      width = dims.width ?? 0;
      height = dims.height ?? 0;
    } catch (err) {
      logger.warn("Image fetch failed: bytes not parseable as image", {
        imageUrl,
        contentType,
        size: buffer.length,
        err,
      });
      return { ok: false, reason: "unsupported_content" };
    }

    return { ok: true, imageUrl, buffer, contentType, width, height };
  } catch (error) {
    logger.error("Image fetch failed: network error", { imageUrl, error });
    return { ok: false, reason: classifyFailureReason(error) };
  }
}

async function uploadImageBuffer(
  fetched: ImageBuffer,
  userId: string,
  supabase: SupabaseClient,
): Promise<StoredImage | null> {
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
type ReadableContent = {
  articleContent: string | null;
  readingTime: number | null;
  wordCount: number;
};

/**
 * Extracts readable article content from HTML via Mozilla Readability, converting
 * it to markdown. Expensive (JSDOM + Readability + Turndown), so callers invoke it
 * lazily and only when the article/webpage decision is actually reached.
 */
function extractReadableContent(
  html: string,
  fetchUrl: string,
  itemId: string,
): ReadableContent {
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

  const wordCount = articleContent?.split(/\s+/).length ?? 0;
  return { articleContent, readingTime, wordCount };
}

export const classifyUrlTask = task({
  id: "classify-url",
  maxDuration: 120, // 2 minutes should be plenty for fetching and classifying
  run: async (payload: ClassifyUrlPayload) => {
    const { itemId, userId, url, forcedKind } = payload;

    const { url: supabaseUrl, key: supabaseKey } = getSupabaseConfig();
    const supabase = createClient(supabaseUrl, supabaseKey);

    logger.log("Starting URL classification", {
      itemId,
      userId,
      url,
      forcedKind,
    });

    try {
      // Step 0: Resolve t.co short URLs (Twitter's shortener) up front so every
      // downstream detector sees the real destination.
      let resolvedUrl = url;
      let originalHostname: string | null = null;
      try {
        originalHostname = new URL(url).hostname;
      } catch {}

      if (detectPlatform(url) === "twitter" && originalHostname === "t.co") {
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
          resolvedUrl = resolveResponse.url;
          logger.log("Resolved t.co URL", {
            itemId,
            originalUrl: url,
            resolvedUrl,
          });
        } catch (resolveError) {
          logger.warn(
            "Failed to resolve t.co URL, will try fetching directly",
            {
              itemId,
              url,
              error: resolveError,
            },
          );
        }
      }

      let fetchUrl = resolvedUrl;

      // Step 1: Classify from the URL alone (tweets, Twitter articles, videos) —
      // no page fetch needed for these. Skipped when a kind is forced: those
      // source-locked kinds aren't reassignable, so a forced kind can never be
      // one of them.
      const urlClassification = forcedKind
        ? null
        : classifyItemKind({
            url,
            resolvedUrl,
            contentType: null,
            html: null,
          });
      if (urlClassification?.kind === "twitter") {
        logger.log("URL classified as Twitter/X post", {
          itemId,
          url: urlClassification.url,
          tweetId: urlClassification.tweetId,
        });
        return await handleTwitterUrl({
          itemId,
          userId,
          url: urlClassification.url,
          tweetId: urlClassification.tweetId,
        });
      }
      if (urlClassification?.kind === "twitterArticle") {
        logger.log("URL classified as Twitter Article", {
          itemId,
          url: urlClassification.url,
          articleId: urlClassification.articleId,
        });
        return await handleTwitterArticle({
          itemId,
          userId,
          url: urlClassification.url,
          articleId: urlClassification.articleId,
        });
      }
      if (urlClassification?.kind === "video") {
        logger.log(`URL classified as ${urlClassification.platform} video`, {
          itemId,
          url: urlClassification.url,
          videoId: urlClassification.videoId,
        });
        return await handleVideoUrl(
          {
            itemId,
            userId,
            url: urlClassification.url,
            platform: urlClassification.platform,
            videoId: urlClassification.videoId,
          },
          supabase,
        );
      }

      // Step 2: HEAD request to check the content type
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

      // Step 3: Direct image URL (by extension or content-type). Skipped when a
      // kind is forced — image isn't a reassignable target.
      if (
        !forcedKind &&
        classifyItemKind({ url, resolvedUrl, contentType, html: null })
          ?.kind === "image"
      ) {
        logger.log("URL classified as direct image", { itemId, url: fetchUrl });
        return await handleImageUrl(itemId, userId, fetchUrl, supabase);
      }

      // Step 4: Fetch the full page content
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
        throw new FetchError(response.status, fetchUrl);
      }

      // The GET follows redirects (amzn.eu → amazon.co.uk, bit.ly, etc.) —
      // classify and extract against the destination so URL-pattern signals
      // (book/product detection) and relative URLs resolve correctly.
      if (response.url && response.url !== fetchUrl) {
        logger.log("URL redirected during fetch", {
          itemId,
          from: fetchUrl,
          to: response.url,
        });
        resolvedUrl = response.url;
        fetchUrl = response.url;
      }

      const finalContentType = response.headers.get("content-type");
      const html = await response.text();

      // Step 5: Classify from the page body — image re-check (some servers don't
      // answer HEAD), then book, product, and finally article vs generic webpage.
      // Article extraction (Readability) is expensive, so it runs lazily and only
      // when the classifier actually needs the readable word count.
      let readableContent: ReadableContent | null = null;
      const getReadableContent = () => {
        if (!readableContent) {
          readableContent = extractReadableContent(html, fetchUrl, itemId);
        }
        return readableContent;
      };

      const classification = classifyItemKind({
        url,
        resolvedUrl,
        contentType: finalContentType,
        html,
        getArticleWordCount: () => getReadableContent().wordCount,
        forcedKind,
      });

      if (classification?.kind === "image") {
        logger.log("URL classified as image after GET", {
          itemId,
          url: fetchUrl,
        });
        return await handleImageUrl(itemId, userId, fetchUrl, supabase);
      }

      if (classification?.kind === "book") {
        logger.log("URL classified as book", {
          itemId,
          url: fetchUrl,
          title: classification.bookMeta.title,
          authors: classification.bookMeta.authors,
          isbn: classification.bookMeta.isbn,
        });
        return await handleBookUrl(
          itemId,
          userId,
          classification.bookMeta,
          supabase,
        );
      }

      if (classification?.kind === "product") {
        const candidates = extractAllProductImageCandidates(html, fetchUrl);
        logger.log("URL classified as product", {
          itemId,
          url: fetchUrl,
          title: classification.productMeta.title,
          brand: classification.productMeta.brand,
          price: classification.productMeta.price,
          candidateCount: candidates.length,
        });
        return await handleProductUrl(
          itemId,
          userId,
          classification.productMeta,
          candidates,
          supabase,
        );
      }

      // Article or generic webpage
      const itemKind =
        classification?.kind === "article" ? "article" : "webpage";
      const metadata =
        classification && "metadata" in classification
          ? classification.metadata
          : extractArticleMetadata(html, fetchUrl);
      const { articleContent, readingTime, wordCount } = getReadableContent();

      logger.log(`URL classified as ${itemKind}`, {
        itemId,
        url,
        title: metadata.title,
        domain: metadata.domain,
        hasOgImage: !!metadata.ogImage,
        hasContent: !!articleContent,
        wordCount,
      });

      // Download cover image if available
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

        if (result.ok) {
          coverResult = { fileKey: result.fileKey, size: result.size };
          logger.log("Cover image stored", {
            itemId,
            coverFileKey: result.fileKey,
          });
        }
      }

      // Update item with data and reconcile cover image storage
      const replacedFileKeys = await db.$transaction(async (tx) => {
        // Reclaim the previous cover's storage before overwriting meta
        const oldFileKeys = await reclaimReplacedStorage(tx, {
          itemId,
          userId,
          addedBytes: coverResult?.size ?? 0,
        });

        await tx.item.update({
          where: { id: itemId, userId },
          data: {
            kind: itemKind,
            title: metadata.title,
            description: metadata.description,
            // Clear file columns the new kind doesn't use so they never point
            // at a blob deleteReplacedFiles is about to remove
            fileKey: null,
            coverFileKey: coverResult ? coverResult.fileKey : null,
            meta: {
              originalName: metadata.title,
              ...(coverResult && { coverSize: coverResult.size }),
            },
          },
        });

        // Drop detail rows from a prior kind (e.g. this was a product before)
        await pruneStaleItemDetails(tx, itemId, itemKind);

        return oldFileKeys;
      });

      // Delete the previous blobs now the new cover is committed
      await deleteReplacedFiles(
        supabase,
        replacedFileKeys,
        coverResult ? [coverResult.fileKey] : [],
      );

      // Upsert article details record (idempotent for retries, only for articles with real content)
      if (itemKind === "article") {
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
      }

      logger.log(`${itemKind} processing complete`, { itemId });

      // Trigger enrichment (tags, text embedding, room sync)
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
        kind: itemKind,
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

      // Mark item as failed with a safe, user-facing reason code
      await db.item.update({
        where: { id: itemId, userId },
        data: {
          processingStatus: "failed",
          processingError: classifyFailureReason(error),
        },
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

  if (!imageResult.ok) {
    // Classified as a direct image but the bytes couldn't be fetched/stored;
    // surface the precise reason (blocked / not-found / unsupported / unreachable)
    throw new ProcessingFailure(
      imageResult.reason,
      "Failed to download image from URL",
    );
  }

  // Update item with image data and reconcile storage
  const replacedFileKeys = await db.$transaction(async (tx) => {
    // Reclaim the previous file's storage before overwriting meta
    const oldFileKeys = await reclaimReplacedStorage(tx, {
      itemId,
      userId,
      addedBytes: imageResult.size,
    });

    await tx.item.update({
      where: { id: itemId, userId },
      data: {
        kind: "image",
        fileKey: imageResult.fileKey,
        // An image has no separate cover; clear any stale one
        coverFileKey: null,
        meta: {
          size: imageResult.size,
          type: imageResult.contentType,
          originalUrl: url,
          ...(imageResult.width > 0 && { width: imageResult.width }),
          ...(imageResult.height > 0 && { height: imageResult.height }),
        },
      },
    });

    // Drop detail rows from a prior kind (e.g. this was an article before)
    await pruneStaleItemDetails(tx, itemId, "image");

    return oldFileKeys;
  });

  // Delete the previous blobs now the new image is committed
  await deleteReplacedFiles(supabase, replacedFileKeys, [imageResult.fileKey]);

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

async function handleBookUrl(
  itemId: string,
  userId: string,
  bookMeta: BookMetadata,
  supabase: SupabaseClient,
) {
  // Download the cover image (single og:image, like articles)
  let coverResult: {
    fileKey: string;
    size: number;
    width: number;
    height: number;
  } | null = null;
  if (bookMeta.ogImage) {
    const result = await downloadAndStoreImage(
      bookMeta.ogImage,
      userId,
      supabase,
    );
    if (result.ok) {
      coverResult = {
        fileKey: result.fileKey,
        size: result.size,
        width: result.width,
        height: result.height,
      };
      logger.log("Book cover stored", { itemId, coverFileKey: result.fileKey });
    }
  }

  const replacedFileKeys = await db.$transaction(async (tx) => {
    // Reclaim the previous cover's storage before overwriting meta
    const oldFileKeys = await reclaimReplacedStorage(tx, {
      itemId,
      userId,
      addedBytes: coverResult?.size ?? 0,
    });

    await tx.item.update({
      where: { id: itemId, userId },
      data: {
        kind: "book",
        title: bookMeta.title,
        description: bookMeta.description,
        // Clear file columns the new kind doesn't use so they never point
        // at a blob deleteReplacedFiles is about to remove
        fileKey: null,
        coverFileKey: coverResult ? coverResult.fileKey : null,
        meta: {
          originalName: bookMeta.title,
          ...(coverResult && { coverSize: coverResult.size }),
          // Cover aspect ratio drives the book display (see lib/book-cover.ts)
          ...(coverResult &&
            coverResult.width > 0 &&
            coverResult.height > 0 && {
              coverWidth: coverResult.width,
              coverHeight: coverResult.height,
            }),
        },
      },
    });

    // Drop detail rows from a prior kind (e.g. this was an article before).
    // Keep image details only if a cover will be analysed to refresh them.
    await pruneStaleItemDetails(tx, itemId, "book", {
      keepImageDetails: !!coverResult,
    });

    return oldFileKeys;
  });

  // Delete the previous blobs now the new cover is committed
  await deleteReplacedFiles(
    supabase,
    replacedFileKeys,
    coverResult ? [coverResult.fileKey] : [],
  );

  const bookDetailsData = {
    authors: bookMeta.authors,
    publisher: bookMeta.publisher,
    publishedAt: bookMeta.publishedAt,
    isbn: bookMeta.isbn,
    pageCount: bookMeta.pageCount,
    domain: bookMeta.domain,
  };
  await db.itemBookDetails.upsert({
    where: { itemId },
    create: { itemId, ...bookDetailsData },
    update: bookDetailsData,
  });

  logger.log("Book processing complete, triggering enrichment", { itemId });

  const sourceText = [
    bookMeta.title,
    bookMeta.authors.join(", "),
    bookMeta.description,
  ]
    .filter(Boolean)
    .join(" ");

  await tasks.trigger<typeof enrichItemTask>("enrich-item", {
    itemId,
    userId,
    sourceText: truncateToTokenLimit(sourceText, 8191),
  });

  // Trigger image analysis on cover for visual tagging and search
  if (coverResult) {
    await tasks.trigger<typeof analyzeImageTask>("analyze-image", {
      itemId,
      userId,
      fileKey: coverResult.fileKey,
    });
  }

  return {
    success: true,
    itemId,
    kind: "book" as const,
    metadata: {
      title: bookMeta.title,
      domain: bookMeta.domain,
      authors: bookMeta.authors,
      isbn: bookMeta.isbn,
      hasCover: !!coverResult,
    },
  };
}

async function handleProductUrl(
  itemId: string,
  userId: string,
  productMeta: ProductMetadata,
  candidates: ProductImageCandidate[],
  supabase: SupabaseClient,
) {
  logger.log("Product image candidates extracted", {
    itemId,
    count: candidates.length,
    candidates: candidates.map((c, i) => ({
      i,
      source: c.source,
      url: c.url,
    })),
  });

  let pickedCandidates: ProductImageCandidate[] = candidates;
  if (candidates.length > 1) {
    const {
      indices: keptIndices,
      usage,
      model,
    } = await selectProductImagesWithLLM({
      imageUrls: candidates.map((c) => c.url),
      productTitle: productMeta.title,
      domain: productMeta.domain,
    });

    if (usage && model) {
      recordAiUsage({
        userId,
        itemId,
        provider: "openai",
        operation: "image_filtering",
        model,
        inputTokens: usage.promptTokens,
        outputTokens: usage.completionTokens,
        source: "ingestion",
      });
    }

    const keptSet = new Set(keptIndices);
    pickedCandidates = keptIndices.map((i) => candidates[i]);
    logger.log("Product images filtered by LLM", {
      itemId,
      keptCount: pickedCandidates.length,
      droppedCount: candidates.length - pickedCandidates.length,
      kept: pickedCandidates.map((c) => c.url),
      dropped: candidates.filter((_, i) => !keptSet.has(i)).map((c) => c.url),
    });
  }

  const toFetch = pickedCandidates.slice(0, DOWNLOAD_BUDGET);

  const fetched = await Promise.all(
    toFetch.map(async (candidate) => {
      const result = await fetchImageBuffer(candidate.url);
      return result.ok
        ? { ...result, source: candidate.source }
        : { url: candidate.url, source: candidate.source, ok: false as const };
    }),
  );

  logger.log("Product images fetched", {
    itemId,
    attempted: fetched.length,
    succeeded: fetched.filter((f) => f.ok).length,
    failed: fetched.filter((f) => !f.ok).length,
    results: fetched.map((f) =>
      f.ok
        ? {
            url: f.imageUrl,
            source: f.source,
            ok: true,
            contentType: f.contentType,
            size: f.buffer.length,
            width: f.width,
            height: f.height,
          }
        : { url: f.url, source: f.source, ok: false },
    ),
  });

  type FetchedCandidate = Extract<(typeof fetched)[number], { ok: true }>;
  const fetchedNonNull = fetched.filter((r): r is FetchedCandidate => r.ok);

  // Order: source priority first (json-ld > og > dom), then largest dim desc
  fetchedNonNull.sort((a, b) => {
    const rankDiff = SOURCE_RANK[a.source] - SOURCE_RANK[b.source];
    if (rankDiff !== 0) return rankDiff;
    return Math.max(b.width, b.height) - Math.max(a.width, a.height);
  });

  const toStore = fetchedNonNull.slice(0, MAX_PRODUCT_IMAGES);
  const cutFromStorage = fetchedNonNull.slice(MAX_PRODUCT_IMAGES);
  if (cutFromStorage.length > 0) {
    logger.log("Product images dropped after sort (over MAX_PRODUCT_IMAGES)", {
      itemId,
      cut: cutFromStorage.map((f) => ({
        url: f.imageUrl,
        source: f.source,
        width: f.width,
        height: f.height,
      })),
    });
  }

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

  logger.log("Product images stored", {
    itemId,
    count: storedImages.length,
    coverUrl: storedImages[0]?.url ?? null,
    images: storedImages.map((s) => ({
      url: s.url,
      fileKey: s.fileKey,
      width: s.width,
      height: s.height,
      size: s.size,
    })),
  });

  const coverFileKey = storedImages[0]?.fileKey ?? null;
  const coverSize = storedImages[0]?.size ?? 0;

  const replacedFileKeys = await db.$transaction(async (tx) => {
    // Reclaim the previous images' storage before overwriting meta. Storage is
    // accounted per the cover only (meta.coverSize), matching reconcile-user-data.
    const oldFileKeys = await reclaimReplacedStorage(tx, {
      itemId,
      userId,
      addedBytes: coverSize,
    });

    await tx.item.update({
      where: { id: itemId, userId },
      data: {
        kind: "product",
        title: productMeta.title,
        description: productMeta.description,
        // Clear file columns the new kind doesn't use so they never point
        // at a blob deleteReplacedFiles is about to remove
        fileKey: null,
        coverFileKey,
        meta: {
          originalName: productMeta.title,
          ...(coverSize > 0 && { coverSize }),
        },
      },
    });

    // Drop detail rows from a prior kind (e.g. this was an article before).
    // Keep image details only if a cover will be analysed to refresh them.
    await pruneStaleItemDetails(tx, itemId, "product", {
      keepImageDetails: !!coverFileKey,
    });

    return oldFileKeys;
  });

  // Delete the previous blobs now the new images are committed
  await deleteReplacedFiles(
    supabase,
    replacedFileKeys,
    storedImages.map((image) => image.fileKey),
  );

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
