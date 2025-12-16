import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { logger, task, tasks } from "@trigger.dev/sdk";
import db from "../src/lib/db";
import type { analyzeImageTask } from "./analyze-image";

type ClassifyUrlPayload = {
  itemId: string;
  userId: string;
  url: string;
};

type ArticleMetadata = {
  title: string | null;
  description: string | null;
  author: string | null;
  domain: string;
  publishedAt: Date | null;
  ogImage: string | null;
};

// Common image extensions
const imageExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".ico",
]);

// Content types that indicate an image
const imageContentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/svg+xml",
  "image/x-icon",
]);

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

function isImageUrl(url: string, contentType?: string): boolean {
  // Check content type first if available
  if (contentType) {
    const mimeType = contentType.split(";")[0].trim().toLowerCase();
    if (imageContentTypes.has(mimeType)) {
      return true;
    }
  }

  // Check URL extension
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname.toLowerCase();
    for (const ext of imageExtensions) {
      if (pathname.endsWith(ext)) {
        return true;
      }
    }
  } catch {
    // Invalid URL, not an image
  }

  return false;
}

function extractMetaContent(html: string, name: string): string | null {
  // Try property (Open Graph)
  const ogMatch = html.match(
    new RegExp(
      `<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
  );
  if (ogMatch) return ogMatch[1];

  // Try name (standard meta)
  const nameMatch = html.match(
    new RegExp(
      `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
  );
  if (nameMatch) return nameMatch[1];

  // Try reversed attribute order
  const reversedOg = html.match(
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`,
      "i",
    ),
  );
  if (reversedOg) return reversedOg[1];

  const reversedName = html.match(
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`,
      "i",
    ),
  );
  if (reversedName) return reversedName[1];

  return null;
}

function extractTitle(html: string): string | null {
  // Try Open Graph title first
  const ogTitle = extractMetaContent(html, "og:title");
  if (ogTitle) return ogTitle;

  // Try Twitter title
  const twitterTitle = extractMetaContent(html, "twitter:title");
  if (twitterTitle) return twitterTitle;

  // Fall back to <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim();

  return null;
}

function extractArticleMetadata(html: string, url: string): ArticleMetadata {
  const parsedUrl = new URL(url);

  return {
    title: extractTitle(html),
    description:
      extractMetaContent(html, "og:description") ||
      extractMetaContent(html, "description") ||
      extractMetaContent(html, "twitter:description"),
    author:
      extractMetaContent(html, "author") ||
      extractMetaContent(html, "article:author"),
    domain: parsedUrl.hostname.replace(/^www\./, ""),
    publishedAt: parsePublishedDate(
      extractMetaContent(html, "article:published_time") ||
        extractMetaContent(html, "datePublished"),
    ),
    ogImage:
      extractMetaContent(html, "og:image") ||
      extractMetaContent(html, "twitter:image"),
  };
}

function parsePublishedDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
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

    // Determine file extension from content type
    const extMap: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
    };
    const ext = extMap[contentType.split(";")[0]] || ".jpg";

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
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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

      logger.log("URL classified as article", {
        itemId,
        url,
        title: metadata.title,
        domain: metadata.domain,
        hasOgImage: !!metadata.ogImage,
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
      await db.item.update({
        where: { id: itemId, userId },
        data: {
          kind: "article",
          title: metadata.title,
          description: metadata.description,
          coverFileKey,
          processingStatus: "completed",
        },
      });

      // Step 6: Create article details record
      await db.itemArticleDetails.create({
        data: {
          itemId,
          author: metadata.author,
          domain: metadata.domain,
          publishedAt: metadata.publishedAt,
        },
      });

      logger.log("Article processing complete", { itemId });

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

  // Update item with image data
  await db.item.update({
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
