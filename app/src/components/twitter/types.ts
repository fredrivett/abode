/**
 * Twitter/X post data types for custom rendering.
 *
 * These types represent the data we extract from react-tweet/api's getTweet()
 * and store for display in our custom components.
 */

export type TwitterMedia = {
  type: "photo" | "video" | "animated_gif";
  url: string;
  width?: number;
  height?: number;
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
  text: string | null;
  postedAt: string | null;
  media: TwitterMedia[] | null;
  quotedTweetId: string | null;
  // Link card data (when tweet contains a URL)
  card: {
    title: string;
    description: string;
    url: string;
    imageUrl: string | null;
  } | null;
  coverMediaIndex: number | null;
};
