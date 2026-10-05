import { Prisma } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger, tasks } from "@trigger.dev/sdk";
import { fetchTweet } from "react-tweet/api";
import { translateToEnglish } from "../src/lib/ai/translate-to-english";
import db from "../src/lib/db";
import { pruneStaleItemDetails } from "../src/lib/item-details";
import { ProcessingFailure } from "../src/lib/items/processing-error";
import { downloadAndStoreImage } from "../src/lib/media/rehost-image";
import { detectPlatform, normalizeUrl } from "../src/lib/platforms";
import {
  type RawTweet,
  transformTweetData,
  tweetDescriptionSource,
  tweetItemTitle,
  tweetSourceText,
} from "../src/lib/twitter/transform-tweet";
import { tweetContextData } from "../src/lib/twitter/tweet-context-data";
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
 * The still image to re-host for a media item: the photo itself, or the poster
 * frame for a video/gif. Videos stream via the twitter-video proxy, so we only
 * persist their poster here.
 */
function mediaStillUrl(item: TwitterMedia): string | null {
  return item.type === "photo" ? item.url : (item.posterUrl ?? null);
}

/** Downloads a tweet image and returns its re-hosted key + size, or null. */
type TweetImageDownloader = (
  url: string,
) => Promise<{ fileKey: string; size: number } | null>;

type RehostResult = {
  media: TwitterMedia[] | null;
  card: TwitterDetails["card"];
  /** Re-hosted key of the author avatar (never a cover, so untracked in size). */
  authorAvatarFileKey: string | null;
  /** Re-hosted key of the cover image (grid preview), for item.coverFileKey. */
  coverFileKey: string | null;
  /** Byte size of the cover image, for meta.coverSize accounting. */
  coverSize: number;
  /** Keys newly uploaded THIS run — delete these to undo orphans on failure. */
  storedFileKeys: string[];
  /**
   * Every key the returned details reference (newly stored *and* pre-existing
   * ones we kept). This is the keep-set for post-commit cleanup: a preserved key
   * is a reclaim "old key" yet still referenced, so it must not be deleted.
   */
  keepFileKeys: string[];
};

/**
 * Re-host a tweet's images (media stills + link-card image + author avatar) into
 * our storage so the saved tweet survives deletion or twimg URL rotation. Each
 * download is best-effort: a failure leaves that image pointing at its original
 * twimg URL.
 *
 * Incremental: an image that already carries a re-hosted key is kept as-is and
 * not re-downloaded, so calling this over already-hosted details upserts only
 * the missing pieces (e.g. an avatar) instead of churning storage.
 *
 * Accounting mirrors products — only the cover counts toward `coverSize`; the
 * other stored keys (extra media, card, avatar) are tracked so reanalysis can
 * reclaim them.
 * Exported for testing (with an injected downloader).
 */
export async function rehostTwitterImages(
  details: Pick<
    TwitterDetails,
    | "media"
    | "card"
    | "coverMediaIndex"
    | "authorAvatarUrl"
    | "authorAvatarFileKey"
  >,
  download: TweetImageDownloader,
): Promise<RehostResult> {
  const sizeByKey = new Map<string, number>();

  let media: TwitterMedia[] | null = null;
  if (details.media && details.media.length > 0) {
    media = await Promise.all(
      details.media.map(async (item): Promise<TwitterMedia> => {
        if (item.fileKey) return item; // already re-hosted — keep it
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
  if (card?.imageUrl && !card.imageFileKey) {
    const stored = await download(card.imageUrl);
    if (stored) {
      sizeByKey.set(stored.fileKey, stored.size);
      card = { ...card, imageFileKey: stored.fileKey };
    }
  }

  // The author avatar is re-hosted like content, but never a cover — so it
  // stays out of coverSize accounting.
  let authorAvatarFileKey = details.authorAvatarFileKey ?? null;
  if (details.authorAvatarUrl && !authorAvatarFileKey) {
    const stored = await download(details.authorAvatarUrl);
    if (stored) {
      sizeByKey.set(stored.fileKey, stored.size);
      authorAvatarFileKey = stored.fileKey;
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

  const keepFileKeys = [
    ...(media?.map((m) => m.fileKey) ?? []),
    card?.imageFileKey,
    authorAvatarFileKey,
  ].filter((key): key is string => typeof key === "string" && key.length > 0);

  return {
    media,
    card,
    authorAvatarFileKey,
    coverFileKey,
    coverSize: coverFileKey ? (sizeByKey.get(coverFileKey) ?? 0) : 0,
    storedFileKeys: [...sizeByKey.keys()],
    keepFileKeys,
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
    // X serves a tombstone to logged-out readers for deleted and protected
    // posts, and for live posts it has marked sensitive — retrying won't help
    throw new ProcessingFailure(
      "source_blocked",
      `Tweet is unavailable to logged-out viewers (deleted, protected or marked sensitive): ${tweetId}`,
    );
  }
  if (result.notFound) {
    throw new ProcessingFailure(
      "source_not_found",
      `Tweet not found: ${tweetId}`,
    );
  }
  if (!result.data) {
    throw new Error(`Failed to fetch tweet: ${tweetId}`);
  }

  const tweet: RawTweet = result.data;

  logger.log("Tweet fetched successfully", {
    itemId,
    tweetId: tweet.id_str,
    authorUsername: tweet.user?.screen_name,
    hasMedia: !!tweet.mediaDetails?.length,
    hasCard: !!tweet.card,
    isArticle: !!tweet.article,
    isTruncated: !!tweet.note_tweet,
  });

  // Transform to our format
  const twitterDetails = transformTweetData(tweet);

  // Re-host tweet images (media stills + card image) so the saved tweet
  // survives deletion or twimg URL rotation. Best-effort per image.
  const rehosted = await rehostTwitterImages(twitterDetails, (imageUrl) =>
    downloadAndStoreImage(imageUrl, userId, supabase),
  );
  // Preserve the previously re-hosted avatar if this run's download failed, so a
  // transient twimg blip on reanalysis doesn't drop the durable copy (and delete
  // its blob) in favour of a hotlink. A successful download still supersedes it.
  const existingAvatar = await db.itemTwitterDetails.findUnique({
    where: { itemId },
    select: { authorAvatarFileKey: true },
  });
  const authorAvatarFileKey =
    rehosted.authorAvatarFileKey ?? existingAvatar?.authorAvatarFileKey ?? null;
  const details: TwitterDetails = {
    ...twitterDetails,
    media: rehosted.media,
    card: rehosted.card,
    authorAvatarFileKey,
  };
  // Keep every key the new row references; a preserved avatar isn't in
  // rehosted.keepFileKeys, so add it or reclaim would delete its live blob.
  const keepFileKeys =
    authorAvatarFileKey && !rehosted.keepFileKeys.includes(authorAvatarFileKey)
      ? [...rehosted.keepFileKeys, authorAvatarFileKey]
      : rehosted.keepFileKeys;
  logger.log("Tweet images re-hosted", {
    itemId,
    stored: rehosted.storedFileKeys.length,
    hasCover: !!rehosted.coverFileKey,
  });

  // Translate tweet text into English for the description (no-op if already English)
  let descriptionEn: string | null = null;
  const descriptionSource = tweetDescriptionSource(twitterDetails);
  if (descriptionSource) {
    try {
      descriptionEn = await translateToEnglish(descriptionSource, {
        userId,
        itemId,
        itemKind: "twitter",
      });
    } catch (error) {
      logger.log("Failed to translate tweet text, falling back to original", {
        itemId,
        error,
      });
      descriptionEn = descriptionSource;
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
          title: tweetItemTitle(details),
          description: descriptionEn?.slice(0, 200) ?? null,
          // Clear file columns the new kind doesn't use so they never point at a
          // blob deleteReplacedFiles is about to remove
          fileKey: null,
          coverFileKey: rehosted.coverFileKey,
          // Only article/webpage items carry a favicon — clear a stale one
          faviconFileKey: null,
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
        authorAvatarFileKey: details.authorAvatarFileKey ?? null,
        postedAt: details.postedAt ? new Date(details.postedAt) : null,
        media: (details.media as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        card: (details.card as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        ...tweetContextData(details),
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

  // Delete the previous blobs now the new images are committed. Keep every key
  // the new row still references (incl. a preserved avatar), not just this run's
  // uploads, or reclaim would delete a live blob.
  await deleteReplacedFiles(supabase, replacedFileKeys, keepFileKeys);

  logger.log("Twitter item saved", { itemId, tweetId });

  // Enrichment (tags, text embedding, room sync). A tweet with a re-hosted
  // cover is enriched by analyze-media-cover as a single job that blends the
  // cover's objects/OCR with the tweet text — so we don't queue a second,
  // text-only enrich here that would race it. A cover-less tweet enriches from
  // its text directly.
  if (rehosted.coverFileKey) {
    logger.log("Triggering cover image analysis + enrichment", {
      itemId,
      fileKey: rehosted.coverFileKey,
    });
    await tasks.trigger<typeof analyzeMediaCoverTask>("analyze-media-cover", {
      itemId,
      userId,
      fileKey: rehosted.coverFileKey,
      extraSourceText: tweetSourceText(details),
    });
  } else {
    logger.log("Triggering item enrichment", { itemId, userId });
    await tasks.trigger<typeof enrichItemTask>("enrich-item", {
      itemId,
      userId,
      sourceText: tweetSourceText(details),
    });
  }

  return {
    success: true,
    itemId,
    kind: "twitter",
    twitterDetails: details,
  };
}
