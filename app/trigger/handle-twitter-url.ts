import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger, tasks } from "@trigger.dev/sdk";
import { fetchTweet, type Tweet } from "react-tweet/api";
import { translateToEnglish } from "../src/lib/ai/translate-to-english";
import db from "../src/lib/db";
import { pruneStaleItemDetails } from "../src/lib/item-details";
import { detectPlatform, normalizeUrl } from "../src/lib/platforms";
import type {
  ExternalLink,
  TwitterDetails,
  TwitterMedia,
} from "../src/lib/types/item";
import type { analyzeMediaCoverTask } from "./analyze-media-cover";
import type { enrichItemTask } from "./enrich-item";
import {
  deleteReplacedFiles,
  reclaimReplacedStorage,
} from "./reclaim-item-storage";

type HandleTwitterUrlPayload = {
  itemId: string;
  userId: string;
  url: string;
  tweetId: string;
};

type HandleTwitterUrlResult = {
  success: true;
  itemId: string;
  kind: "twitter";
  twitterDetails: TwitterDetails;
};

/**
 * Transform raw tweet data from react-tweet/api into our TwitterDetails format.
 * Exported for testing purposes.
 */
export function transformTweetData(tweet: Tweet): TwitterDetails {
  // Transform media array
  let media: TwitterMedia[] | null = null;
  if (tweet.mediaDetails && tweet.mediaDetails.length > 0) {
    media = tweet.mediaDetails.map((m): TwitterMedia => {
      const base: TwitterMedia = {
        type: m.type as "photo" | "video" | "animated_gif",
        url: m.media_url_https,
        width: m.original_info?.width,
        height: m.original_info?.height,
      };

      // Add video-specific fields
      if ("video_info" in m && m.video_info) {
        base.posterUrl = m.media_url_https;
        base.variants = m.video_info.variants
          .filter((v) => v.content_type?.startsWith("video/"))
          .map((v) => ({
            type: v.content_type ?? "video/mp4",
            src: v.url,
            bitrate: v.bitrate,
          }));
      }

      return base;
    });
  }

  // Transform link card if present
  // Note: react-tweet types don't include 'card' but it may be present in the raw data
  let card: TwitterDetails["card"] = null;
  const rawTweet = tweet as typeof tweet & {
    card?: {
      url?: string;
      binding_values?: Record<
        string,
        { string_value?: string; image_value?: { url?: string } }
      >;
    };
  };
  if (rawTweet.card) {
    // Extract card values from the binding_values object
    const values = rawTweet.card.binding_values;

    const title = values?.title?.string_value;
    const description = values?.description?.string_value;
    const cardUrl = values?.url?.string_value ?? rawTweet.card.url;
    const imageUrl =
      values?.thumbnail_image_large?.image_value?.url ??
      values?.thumbnail_image?.image_value?.url ??
      values?.player_image_large?.image_value?.url ??
      null;

    if (title || description) {
      card = {
        title: title ?? "",
        description: description ?? "",
        url: cardUrl ?? "",
        imageUrl,
      };
    }
  }

  if (!tweet.user?.screen_name) {
    throw new Error(`Tweet ${tweet.id_str} is missing author username`);
  }

  return {
    tweetId: tweet.id_str,
    authorName: tweet.user.name ?? null,
    authorUsername: tweet.user.screen_name,
    authorAvatarUrl: tweet.user.profile_image_url_https ?? null,
    text: tweet.text ?? null,
    postedAt: tweet.created_at
      ? new Date(tweet.created_at).toISOString()
      : null,
    media,
    quotedTweetId: tweet.quoted_tweet?.id_str ?? null,
    card,
    coverMediaIndex: null,
  };
}

/**
 * The still image to re-host for a media item: the photo itself, or the poster
 * frame for a video/gif. Videos stream via the twitter-video proxy, so we only
 * persist their poster here.
 */
function mediaStillUrl(item: TwitterMedia): string | null {
  return item.type === "photo" ? item.url : (item.posterUrl ?? null);
}

// Only re-host raster formats the renderers actually support. Notably excludes
// SVG: the image proxy serves stored bytes same-origin as image/svg+xml, so a
// persisted SVG (e.g. a malicious link-card image) becomes active content when
// opened directly. Card images come from arbitrary third-party pages, so this
// allowlist is a real boundary, not a formality.
const IMAGE_EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

/**
 * Storage extension for a re-hostable image content-type, or null to reject it
 * (unsupported or unsafe, e.g. SVG). Exported for testing.
 */
export function imageExtForContentType(contentType: string): string | null {
  const baseType = contentType.split(";")[0].trim().toLowerCase();
  return IMAGE_EXT_BY_CONTENT_TYPE[baseType] ?? null;
}

/**
 * Downloads an image from a URL and stores it in Supabase storage.
 * Returns the file key and byte size, or null on any failure (skip cleanly).
 * Exported for reuse by the tweet-image backfill task.
 */
export async function downloadAndStoreImage(
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
      logger.warn("Failed to download tweet image", {
        imageUrl,
        status: response.status,
      });
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    const ext = imageExtForContentType(contentType);
    if (!ext) {
      logger.warn("Tweet image had unsupported content-type", {
        imageUrl,
        contentType: contentType || "(none)",
      });
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const fileKey = `${userId}/${randomUUID()}${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("items")
      .upload(fileKey, buffer, { contentType, upsert: false });
    if (uploadError) {
      logger.error("Failed to upload tweet image to storage", {
        imageUrl,
        error: uploadError,
      });
      return null;
    }

    return { fileKey, size: buffer.length };
  } catch (error) {
    logger.error("Error downloading/storing tweet image", { imageUrl, error });
    return null;
  }
}

/** Downloads a tweet image and returns its re-hosted key + size, or null. */
type TweetImageDownloader = (
  url: string,
) => Promise<{ fileKey: string; size: number } | null>;

type RehostResult = {
  media: TwitterMedia[] | null;
  card: TwitterDetails["card"];
  /** Re-hosted key of the cover image (grid preview), for item.coverFileKey. */
  coverFileKey: string | null;
  /** Byte size of the cover image, for meta.coverSize accounting. */
  coverSize: number;
  /** Every key we stored this run, so the caller can keep them on cleanup. */
  storedFileKeys: string[];
};

/**
 * Re-host a tweet's images (media stills + link-card image) into our storage so
 * the saved tweet survives deletion or twimg URL rotation. Each download is
 * best-effort: a failure leaves that image pointing at its original twimg URL.
 *
 * Accounting mirrors products — only the cover counts toward `coverSize`; the
 * other stored keys are tracked so reanalysis can reclaim them.
 * Exported for testing (with an injected downloader).
 */
export async function rehostTwitterImages(
  details: Pick<TwitterDetails, "media" | "card" | "coverMediaIndex">,
  download: TweetImageDownloader,
): Promise<RehostResult> {
  const sizeByKey = new Map<string, number>();

  let media: TwitterMedia[] | null = null;
  if (details.media && details.media.length > 0) {
    media = await Promise.all(
      details.media.map(async (item): Promise<TwitterMedia> => {
        const stillUrl = mediaStillUrl(item);
        if (!stillUrl) return item;
        const stored = await download(stillUrl);
        if (!stored) return item;
        sizeByKey.set(stored.fileKey, stored.size);
        return { ...item, fileKey: stored.fileKey };
      }),
    );
  }

  let card = details.card;
  if (card?.imageUrl) {
    const stored = await download(card.imageUrl);
    if (stored) {
      sizeByKey.set(stored.fileKey, stored.size);
      card = { ...card, imageFileKey: stored.fileKey };
    }
  }

  // Cover mirrors the grid preview: the chosen cover media's still, else the
  // first media that actually hosted (a rotted cover must not null the cover
  // when a later image succeeded, or that upload leaks), else the card image.
  // This makes coverFileKey null iff nothing was hosted (storedFileKeys empty).
  const coverIndex = details.coverMediaIndex ?? 0;
  const firstHostedMediaKey = media?.find((m) => m.fileKey)?.fileKey;
  const coverFileKey =
    media?.[coverIndex]?.fileKey ??
    firstHostedMediaKey ??
    card?.imageFileKey ??
    null;

  return {
    media,
    card,
    coverFileKey,
    coverSize: coverFileKey ? (sizeByKey.get(coverFileKey) ?? 0) : 0,
    storedFileKeys: [...sizeByKey.keys()],
  };
}

/**
 * Handle a Twitter/X URL by fetching tweet data and storing it.
 */
export async function handleTwitterUrl(
  payload: HandleTwitterUrlPayload,
  supabase: SupabaseClient,
): Promise<HandleTwitterUrlResult> {
  const { itemId, userId, url, tweetId } = payload;

  logger.log("Fetching tweet data", { itemId, tweetId, url });

  // Fetch tweet data using react-tweet/api
  // fetchTweet provides more detailed error info than getTweet
  const result = await fetchTweet(tweetId);

  if (result.tombstone) {
    throw new Error(
      `Tweet is no longer available (deleted or private): ${tweetId}`,
    );
  }
  if (result.notFound) {
    throw new Error(`Tweet not found: ${tweetId}`);
  }
  if (!result.data) {
    throw new Error(`Failed to fetch tweet: ${tweetId}`);
  }

  const tweet = result.data;

  logger.log("Tweet fetched successfully", {
    itemId,
    tweetId: tweet.id_str,
    authorUsername: tweet.user?.screen_name,
    hasMedia: !!tweet.mediaDetails?.length,
    // Card may exist in raw data but isn't in the Tweet type
    hasCard: !!(tweet as { card?: unknown }).card,
  });

  // Transform to our format
  const twitterDetails = transformTweetData(tweet);

  // Re-host tweet images (media stills + card image) so the saved tweet
  // survives deletion or twimg URL rotation. Best-effort per image.
  const rehosted = await rehostTwitterImages(twitterDetails, (imageUrl) =>
    downloadAndStoreImage(imageUrl, userId, supabase),
  );
  const details: TwitterDetails = {
    ...twitterDetails,
    media: rehosted.media,
    card: rehosted.card,
  };
  logger.log("Tweet images re-hosted", {
    itemId,
    stored: rehosted.storedFileKeys.length,
    hasCover: !!rehosted.coverFileKey,
  });

  // Translate tweet text into English for the description (no-op if already English)
  let descriptionEn: string | null = null;
  if (twitterDetails.text) {
    try {
      descriptionEn = await translateToEnglish(twitterDetails.text);
    } catch (error) {
      logger.log("Failed to translate tweet text, falling back to original", {
        itemId,
        error,
      });
      descriptionEn = twitterDetails.text;
    }
  }

  // Update item and create twitter details in a transaction
  const normalizedUrl = normalizeUrl(url);

  let replacedFileKeys: string[];
  try {
    replacedFileKeys = await db.$transaction(async (tx) => {
      // Reclaim the previous images' storage before overwriting meta. Accounting
      // is cover-only (meta.coverSize), matching products / reconcile-user-data.
      const oldFileKeys = await reclaimReplacedStorage(tx, {
        itemId,
        userId,
        addedBytes: rehosted.coverSize,
      });

      const item = await tx.item.findUniqueOrThrow({
        where: { id: itemId, userId },
        select: { externalLinks: true },
      });

      const existingLinks = (item.externalLinks as ExternalLink[] | null) ?? [];
      const hasLink = existingLinks.some(
        (link) => normalizeUrl(link.url) === normalizedUrl,
      );

      await tx.item.update({
        where: { id: itemId, userId },
        data: {
          kind: "twitter",
          title: `Tweet by @${details.authorUsername}`,
          description: descriptionEn?.slice(0, 200) ?? null,
          // Clear file columns the new kind doesn't use so they never point at a
          // blob deleteReplacedFiles is about to remove
          fileKey: null,
          coverFileKey: rehosted.coverFileKey,
          meta:
            rehosted.coverSize > 0
              ? { coverSize: rehosted.coverSize }
              : Prisma.JsonNull,
          externalLinks: hasLink
            ? undefined
            : [
                ...existingLinks,
                { url: normalizedUrl, platform: detectPlatform(normalizedUrl) },
              ],
        },
      });

      // Drop detail rows from a prior kind (e.g. this was an article before)
      await pruneStaleItemDetails(tx, itemId, "twitter");

      // Upsert twitter details record (idempotent for retries)
      // For JSON fields, use Prisma.JsonNull for null values, or cast to InputJsonValue
      const detailsData = {
        tweetId: details.tweetId,
        authorName: details.authorName,
        authorUsername: details.authorUsername,
        authorAvatarUrl: details.authorAvatarUrl,
        text: details.text,
        postedAt: details.postedAt ? new Date(details.postedAt) : null,
        media: (details.media as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        quotedTweetId: details.quotedTweetId,
        card: (details.card as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      };
      await tx.itemTwitterDetails.upsert({
        where: { itemId },
        create: { itemId, ...detailsData },
        update: detailsData,
      });

      return oldFileKeys;
    });
  } catch (error) {
    // The images were uploaded before this transaction; a failed commit orphans
    // them (no row references them). Delete them so Trigger retries don't
    // accumulate orphans. Best-effort — never masks the original error. Only
    // safe here because the commit didn't happen; post-commit failures below
    // must not reach this path or they'd delete referenced blobs.
    await deleteReplacedFiles(supabase, rehosted.storedFileKeys, []);
    throw error;
  }

  // Delete the previous blobs now the new images are committed
  await deleteReplacedFiles(
    supabase,
    replacedFileKeys,
    rehosted.storedFileKeys,
  );

  logger.log("Twitter item saved", { itemId, tweetId });

  // Trigger enrichment (tags, text embedding, room sync). This completes the
  // item from the tweet text alone; cover analysis (below) refines it.
  logger.log("Triggering item enrichment", { itemId, userId });
  await tasks.trigger<typeof enrichItemTask>("enrich-item", {
    itemId,
    userId,
    sourceText: details.text ?? undefined,
  });

  // Analyse the cover image (objects/OCR/colours/embedding) into the per-image
  // cache and mirror it to the item-level search/similar surfaces. Best-effort
  // refinement — a failure here never fails the (already-enriched) tweet.
  if (rehosted.coverFileKey) {
    logger.log("Triggering cover image analysis", {
      itemId,
      fileKey: rehosted.coverFileKey,
    });
    await tasks.trigger<typeof analyzeMediaCoverTask>("analyze-media-cover", {
      itemId,
      userId,
      fileKey: rehosted.coverFileKey,
      extraSourceText: details.text ?? undefined,
    });
  }

  return {
    success: true,
    itemId,
    kind: "twitter",
    twitterDetails: details,
  };
}
