/**
 * Video metadata utilities for YouTube and Vimeo
 * Uses oEmbed APIs (no API keys required)
 */

export type YouTubeOEmbedResponse = {
  title: string;
  author_name: string;
  author_url: string;
  type: "video";
  height: number;
  width: number;
  version: string;
  provider_name: "YouTube";
  provider_url: string;
  thumbnail_url: string;
  thumbnail_height: number;
  thumbnail_width: number;
  html: string;
};

export type VimeoOEmbedResponse = {
  type: "video";
  version: string;
  provider_name: "Vimeo";
  provider_url: string;
  title: string;
  author_name: string;
  author_url: string;
  is_plus: string;
  account_type: string;
  html: string;
  width: number;
  height: number;
  duration: number;
  description: string;
  thumbnail_url: string;
  thumbnail_width: number;
  thumbnail_height: number;
  thumbnail_url_with_play_button: string;
  upload_date: string;
  video_id: number;
  uri: string;
};

export type VideoMetadata = {
  title: string;
  channelName: string;
  channelUrl: string | null;
  thumbnailUrl: string;
  duration: number | null;
  embedUrl: string;
};

/**
 * Fetch YouTube video metadata via oEmbed API
 */
export async function fetchYouTubeOEmbed(
  url: string,
): Promise<YouTubeOEmbedResponse | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl);

    if (!response.ok) {
      console.error(
        `YouTube oEmbed failed: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    return (await response.json()) as YouTubeOEmbedResponse;
  } catch (error) {
    console.error("YouTube oEmbed error:", error);
    return null;
  }
}

/**
 * Fetch Vimeo video metadata via oEmbed API
 */
export async function fetchVimeoOEmbed(
  url: string,
): Promise<VimeoOEmbedResponse | null> {
  try {
    const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
    const response = await fetch(oembedUrl);

    if (!response.ok) {
      console.error(
        `Vimeo oEmbed failed: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    return (await response.json()) as VimeoOEmbedResponse;
  } catch (error) {
    console.error("Vimeo oEmbed error:", error);
    return null;
  }
}

/**
 * Get YouTube thumbnail URL
 * YouTube has predictable thumbnail URLs based on video ID
 * Returns the highest quality thumbnail URL (maxresdefault)
 * Note: maxresdefault may not exist for all videos, caller should fallback to hqdefault
 */
export function getYouTubeThumbnailUrl(
  videoId: string,
  highRes = true,
): string {
  const quality = highRes ? "maxresdefault" : "hqdefault";
  return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
}

/**
 * Get privacy-respecting video embed URL
 * Uses youtube-nocookie.com for YouTube to prevent tracking
 * Includes autoplay=1 for use with facade pattern (thumbnail → iframe on click)
 */
export function getVideoEmbedUrl(
  platform: "youtube" | "vimeo",
  videoId: string,
): string {
  if (platform === "youtube") {
    // Use youtube-nocookie.com for privacy
    // rel=0 disables related videos, modestbranding=1 reduces YouTube branding
    // autoplay=1 for facade pattern - video starts when iframe loads after user clicks
    return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=1`;
  }

  // Vimeo embed URL
  // dnt=1 enables do-not-track mode
  // autoplay=1 for facade pattern - video starts when iframe loads after user clicks
  return `https://player.vimeo.com/video/${videoId}?dnt=1&autoplay=1`;
}

/**
 * Fetch video metadata for a YouTube video
 */
export async function fetchYouTubeMetadata(
  url: string,
  videoId: string,
): Promise<VideoMetadata | null> {
  const oembed = await fetchYouTubeOEmbed(url);

  if (!oembed) {
    return null;
  }

  return {
    title: oembed.title,
    channelName: oembed.author_name,
    channelUrl: oembed.author_url || null,
    thumbnailUrl: getYouTubeThumbnailUrl(videoId, true),
    duration: null, // YouTube oEmbed doesn't provide duration
    embedUrl: getVideoEmbedUrl("youtube", videoId),
  };
}

/**
 * Fetch video metadata for a Vimeo video
 */
export async function fetchVimeoMetadata(
  url: string,
  videoId: string,
): Promise<VideoMetadata | null> {
  const oembed = await fetchVimeoOEmbed(url);

  if (!oembed) {
    return null;
  }

  return {
    title: oembed.title,
    channelName: oembed.author_name,
    channelUrl: oembed.author_url || null,
    thumbnailUrl: oembed.thumbnail_url,
    duration: oembed.duration || null,
    embedUrl: getVideoEmbedUrl("vimeo", videoId),
  };
}

/**
 * Fetch video metadata for any supported platform
 */
export async function fetchVideoMetadata(
  platform: "youtube" | "vimeo",
  url: string,
  videoId: string,
): Promise<VideoMetadata | null> {
  if (platform === "youtube") {
    return fetchYouTubeMetadata(url, videoId);
  }
  return fetchVimeoMetadata(url, videoId);
}

/**
 * Check if a YouTube thumbnail URL exists (maxresdefault may not exist for all videos)
 * Returns true if the thumbnail exists, false otherwise
 */
export async function checkYouTubeThumbnailExists(
  thumbnailUrl: string,
): Promise<boolean> {
  try {
    const response = await fetch(thumbnailUrl, { method: "HEAD" });
    // YouTube returns 404 for missing thumbnails
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get the best available YouTube thumbnail URL
 * Tries maxresdefault first, falls back to hqdefault
 */
export async function getBestYouTubeThumbnailUrl(
  videoId: string,
): Promise<string> {
  const maxresUrl = getYouTubeThumbnailUrl(videoId, true);

  if (await checkYouTubeThumbnailExists(maxresUrl)) {
    return maxresUrl;
  }

  // Fallback to hqdefault which always exists
  return getYouTubeThumbnailUrl(videoId, false);
}
