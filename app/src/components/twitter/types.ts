/**
 * Twitter/X post data types for custom rendering.
 *
 * These types represent the data we extract from react-tweet/api's getTweet()
 * and store for display in our custom components.
 */

import type {
  QuotedTweet,
  TweetPoll,
  TweetReplyContext,
} from "@/lib/twitter/tweet-context";

export type { QuotedTweet, TweetPoll, TweetReplyContext };

export type TwitterMedia = {
  type: "photo" | "video" | "animated_gif";
  url: string;
  width?: number;
  height?: number;
  // Our re-hosted copy of the still image (the photo, or a video/gif poster).
  // Absent for items captured before re-hosting, or when the download failed —
  // renderers fall back to `url`/`posterUrl` (the original twimg URL).
  fileKey?: string;
  // For videos
  posterUrl?: string;
  variants?: Array<{
    type: string;
    src: string;
    bitrate?: number;
  }>;
};

export type TwitterDetails = {
  tweetId: string;
  authorName: string | null;
  authorUsername: string;
  authorAvatarUrl: string | null;
  authorAvatarFileKey?: string | null;
  text: string | null;
  // Long-form post: `text` is only the first ~280 chars (X's embed data stops there)
  isTruncated: boolean;
  postedAt: string | null;
  media: TwitterMedia[] | null;
  quotedTweetId: string | null;
  quotedTweet: QuotedTweet | null;
  // Link card data (when tweet contains a URL), or an X Article's preview
  card: {
    // Absent on link cards (incl. every card captured before Articles)
    type?: "article";
    title: string;
    description: string;
    url: string;
    imageUrl: string | null;
    // Our re-hosted copy of the card image (fallback: imageUrl)
    imageFileKey?: string | null;
  } | null;
  poll: TweetPoll | null;
  inReplyTo: TweetReplyContext | null;
  coverMediaIndex: number | null;
};
