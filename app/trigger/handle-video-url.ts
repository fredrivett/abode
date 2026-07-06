import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger, tasks } from "@trigger.dev/sdk";
import db from "../src/lib/db";
import { pruneStaleItemDetails } from "../src/lib/item-details";
import {
  fetchVideoMetadata,
  getBestYouTubeThumbnailUrl,
} from "../src/lib/video-metadata";
import type { enrichItemTask } from "./enrich-item";

export type VideoPlatform = "youtube" | "vimeo";

type HandleVideoUrlPayload = {
  itemId: string;
  userId: string;
  url: string;
  platform: VideoPlatform;
  videoId: string;
};

type HandleVideoUrlResult = {
  success: true;
  itemId: string;
  kind: "video";
  platform: VideoPlatform;
  videoId: string;
  title: string;
};

/**
 * Downloads an image from a URL and stores it in Supabase storage.
 * Returns the file key and size.
 */
async function downloadAndStoreThumbnail(
  imageUrl: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<{ fileKey: string; size: number } | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AbodeBot/1.0; +https://www.abode.fyi)",
      },
    });

    if (!response.ok) {
      logger.warn("Failed to download thumbnail", {
        imageUrl,
        status: response.status,
      });
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await response.arrayBuffer());

    // Get extension from content type
    const extMap: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/jpg": ".jpg",
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
      logger.error("Failed to upload thumbnail to storage", {
        imageUrl,
        error: uploadError,
      });
      return null;
    }

    return { fileKey, size: buffer.length };
  } catch (error) {
    logger.error("Error downloading/storing thumbnail", { imageUrl, error });
    return null;
  }
}

/**
 * Handle a YouTube or Vimeo URL by fetching video metadata and storing it.
 */
export async function handleVideoUrl(
  payload: HandleVideoUrlPayload,
  supabase: SupabaseClient,
): Promise<HandleVideoUrlResult> {
  const { itemId, userId, url, platform, videoId } = payload;

  logger.log("Fetching video metadata", { itemId, platform, videoId, url });

  // Fetch video metadata via oEmbed
  const metadata = await fetchVideoMetadata(platform, url, videoId);

  if (!metadata) {
    throw new Error(
      `Failed to fetch ${platform} metadata for video: ${videoId}`,
    );
  }

  logger.log("Video metadata fetched", {
    itemId,
    platform,
    videoId,
    title: metadata.title,
    channelName: metadata.channelName,
    hasDuration: !!metadata.duration,
  });

  // Determine thumbnail URL
  // For YouTube, try to get the best quality thumbnail
  let thumbnailUrl = metadata.thumbnailUrl;
  if (platform === "youtube") {
    thumbnailUrl = await getBestYouTubeThumbnailUrl(videoId);
    logger.log("Using YouTube thumbnail", { itemId, thumbnailUrl });
  }

  // Download and store thumbnail
  logger.log("Downloading video thumbnail", { itemId, thumbnailUrl });

  const thumbnailResult = await downloadAndStoreThumbnail(
    thumbnailUrl,
    userId,
    supabase,
  );

  if (thumbnailResult) {
    logger.log("Thumbnail stored", {
      itemId,
      coverFileKey: thumbnailResult.fileKey,
      size: thumbnailResult.size,
    });
  } else {
    logger.warn("Failed to store thumbnail, continuing without cover", {
      itemId,
      thumbnailUrl,
    });
  }

  // Update item and create video details in a transaction
  await db.$transaction(async (tx) => {
    // Update item with video metadata
    await tx.item.update({
      where: { id: itemId, userId },
      data: {
        kind: "video",
        title: metadata.title,
        ...(thumbnailResult && { coverFileKey: thumbnailResult.fileKey }),
        meta: {
          originalName: metadata.title,
          ...(thumbnailResult && { coverSize: thumbnailResult.size }),
          ...(metadata.thumbnailWidth && { width: metadata.thumbnailWidth }),
          ...(metadata.thumbnailHeight && { height: metadata.thumbnailHeight }),
        },
      },
    });

    // Drop detail rows from a prior kind (e.g. this was an article before)
    await pruneStaleItemDetails(tx, itemId, "video");

    // Update storage accounting for thumbnail
    if (thumbnailResult && thumbnailResult.size > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { storageUsedBytes: { increment: BigInt(thumbnailResult.size) } },
      });
    }

    // Upsert video details record (idempotent for retries)
    const videoDetailsData = {
      platform,
      videoId,
      channelName: metadata.channelName,
      channelUrl: metadata.channelUrl,
      duration: metadata.duration,
      embedUrl: metadata.embedUrl,
      thumbnailUrl: metadata.thumbnailUrl,
    };
    await tx.itemVideoDetails.upsert({
      where: { itemId },
      create: { itemId, ...videoDetailsData },
      update: videoDetailsData,
    });
  });

  logger.log("Video item saved", { itemId, platform, videoId });

  // Trigger enrichment (tags, text embedding, room sync)
  // TODO: Use YouTube Data API to fetch video descriptions for richer tag generation
  const sourceText = [metadata.title, metadata.channelName]
    .filter(Boolean)
    .join(" - ");

  logger.log("Triggering item enrichment", { itemId, userId });
  await tasks.trigger<typeof enrichItemTask>("enrich-item", {
    itemId,
    userId,
    sourceText: sourceText || undefined,
  });

  return {
    success: true,
    itemId,
    kind: "video",
    platform,
    videoId,
    title: metadata.title,
  };
}
