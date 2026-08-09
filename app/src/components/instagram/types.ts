/**
 * Instagram post data types for custom rendering.
 *
 * These represent the data we extract from an Instagram post and store for
 * display in our custom components. A URL-paste capture is partial (a single
 * OpenGraph cover image); the browser extension can later enrich it to the full
 * set of carousel media.
 */

export type InstagramMediaType = "post" | "reel" | "tv";

export type InstagramMedia = {
  type: "photo" | "video";
  url: string;
  width?: number;
  height?: number;
  // Our re-hosted copy of the still image. Absent when the download failed —
  // renderers fall back to `url` (the original cdninstagram URL, which expires).
  fileKey?: string;
  // For videos: the poster still (a playable source only comes via the extension)
  posterUrl?: string;
};

export type InstagramDetails = {
  postId: string;
  mediaType: InstagramMediaType;
  authorName: string | null;
  authorUsername: string;
  caption: string | null;
  postedAt: string | null;
  media: InstagramMedia[] | null;
  likeCount: number | null;
  commentCount: number | null;
  coverMediaIndex: number | null;
};
