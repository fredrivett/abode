import { Prisma } from "@prisma/client";
import { logger, tasks } from "@trigger.dev/sdk";
import { fetchTweet, type Tweet } from "react-tweet/api";
import db from "../src/lib/db";
import type { TwitterDetails, TwitterMedia } from "../src/lib/types/item";
import type { syncItemToRoomsTask } from "./sync-item-to-rooms";

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
 */
function transformTweetData(tweet: Tweet): TwitterDetails {
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
    const imageUrl = values?.thumbnail_image_large?.image_value?.url ??
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
    postedAt: tweet.created_at ? new Date(tweet.created_at).toISOString() : null,
    media,
    quotedTweetId: tweet.quoted_tweet?.id_str ?? null,
    card,
  };
}

/**
 * Handle a Twitter/X URL by fetching tweet data and storing it.
 */
export async function handleTwitterUrl(
  payload: HandleTwitterUrlPayload,
): Promise<HandleTwitterUrlResult> {
  const { itemId, userId, url, tweetId } = payload;

  logger.log("Fetching tweet data", { itemId, tweetId, url });

  // Fetch tweet data using react-tweet/api
  // fetchTweet provides more detailed error info than getTweet
  const result = await fetchTweet(tweetId);

  if (result.tombstone) {
    throw new Error(`Tweet is no longer available (deleted or private): ${tweetId}`);
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

  // Update item and create twitter details in a transaction
  await db.$transaction(async (tx) => {
    // Update item with twitter metadata
    await tx.item.update({
      where: { id: itemId, userId },
      data: {
        kind: "twitter",
        title: `Tweet by @${twitterDetails.authorUsername}`,
        description: twitterDetails.text?.slice(0, 200) ?? null,
        processingStatus: "completed",
      },
    });

    // Create twitter details record
    // For JSON fields, use Prisma.JsonNull for null values, or cast to InputJsonValue
    await tx.itemTwitterDetails.create({
      data: {
        itemId,
        tweetId: twitterDetails.tweetId,
        authorName: twitterDetails.authorName,
        authorUsername: twitterDetails.authorUsername,
        authorAvatarUrl: twitterDetails.authorAvatarUrl,
        text: twitterDetails.text,
        postedAt: twitterDetails.postedAt ? new Date(twitterDetails.postedAt) : null,
        media: (twitterDetails.media as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        quotedTweetId: twitterDetails.quotedTweetId,
        card: (twitterDetails.card as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  });

  logger.log("Twitter item saved", { itemId, tweetId });

  // Trigger smart room sync
  logger.log("Triggering smart room sync", { itemId, userId });
  await tasks.trigger<typeof syncItemToRoomsTask>("sync-item-to-rooms", {
    itemId,
    userId,
  });

  return {
    success: true,
    itemId,
    kind: "twitter",
    twitterDetails,
  };
}
