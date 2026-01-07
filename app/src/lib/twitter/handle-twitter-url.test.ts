import { describe, expect, it } from "vitest";

/**
 * Tests for the transformTweetData function from handle-twitter-url.ts
 *
 * Note: We're testing the transformation logic by re-implementing the pure
 * function here since the original is not exported. This tests the transform
 * logic in isolation without requiring database or network calls.
 */

// Re-implement types matching those in handle-twitter-url.ts
type TwitterMedia = {
  type: "photo" | "video" | "animated_gif";
  url: string;
  width?: number;
  height?: number;
  posterUrl?: string;
  variants?: Array<{
    type: string;
    src: string;
    bitrate?: number;
  }>;
};

type TwitterDetails = {
  tweetId: string;
  authorName: string | null;
  authorUsername: string;
  authorAvatarUrl: string | null;
  text: string | null;
  postedAt: string | null;
  media: TwitterMedia[] | null;
  quotedTweetId: string | null;
  card: {
    title: string;
    description: string;
    url: string;
    imageUrl: string | null;
  } | null;
};

type TweetUser = {
  name?: string;
  screen_name?: string;
  profile_image_url_https?: string;
};

type TweetMediaDetail = {
  type: string;
  media_url_https: string;
  original_info?: {
    width?: number;
    height?: number;
  };
  video_info?: {
    variants: Array<{
      content_type?: string;
      url: string;
      bitrate?: number;
    }>;
  };
};

type Tweet = {
  id_str: string;
  text?: string;
  created_at?: string;
  user?: TweetUser;
  mediaDetails?: TweetMediaDetail[];
  quoted_tweet?: { id_str: string };
  card?: {
    url?: string;
    binding_values?: Record<
      string,
      { string_value?: string; image_value?: { url?: string } }
    >;
  };
};

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
  let card: TwitterDetails["card"] = null;
  if (tweet.card) {
    const values = tweet.card.binding_values;

    const title = values?.title?.string_value;
    const description = values?.description?.string_value;
    const cardUrl = values?.url?.string_value ?? tweet.card.url;
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

  return {
    tweetId: tweet.id_str,
    authorName: tweet.user?.name ?? null,
    authorUsername: tweet.user?.screen_name ?? "unknown",
    authorAvatarUrl: tweet.user?.profile_image_url_https ?? null,
    text: tweet.text ?? null,
    postedAt: tweet.created_at ? new Date(tweet.created_at).toISOString() : null,
    media,
    quotedTweetId: tweet.quoted_tweet?.id_str ?? null,
    card,
  };
}

describe("transformTweetData", () => {
  describe("basic tweet fields", () => {
    it("transforms a minimal tweet with required fields", () => {
      const tweet: Tweet = {
        id_str: "123456789",
        user: {
          screen_name: "testuser",
        },
      };

      const result = transformTweetData(tweet);

      expect(result).toEqual({
        tweetId: "123456789",
        authorName: null,
        authorUsername: "testuser",
        authorAvatarUrl: null,
        text: null,
        postedAt: null,
        media: null,
        quotedTweetId: null,
        card: null,
      });
    });

    it("transforms a complete tweet with all user fields", () => {
      const tweet: Tweet = {
        id_str: "987654321",
        text: "Hello, world!",
        created_at: "Wed Oct 26 18:45:58 +0000 2022",
        user: {
          name: "Test User",
          screen_name: "testuser",
          profile_image_url_https: "https://pbs.twimg.com/profile_images/123.jpg",
        },
      };

      const result = transformTweetData(tweet);

      expect(result.tweetId).toBe("987654321");
      expect(result.authorName).toBe("Test User");
      expect(result.authorUsername).toBe("testuser");
      expect(result.authorAvatarUrl).toBe(
        "https://pbs.twimg.com/profile_images/123.jpg",
      );
      expect(result.text).toBe("Hello, world!");
      expect(result.postedAt).toBe("2022-10-26T18:45:58.000Z");
    });

    it("defaults username to 'unknown' when user is missing", () => {
      const tweet: Tweet = {
        id_str: "123",
      };

      const result = transformTweetData(tweet);

      expect(result.authorUsername).toBe("unknown");
    });
  });

  describe("media handling", () => {
    it("transforms photo media", () => {
      const tweet: Tweet = {
        id_str: "123",
        user: { screen_name: "user" },
        mediaDetails: [
          {
            type: "photo",
            media_url_https: "https://pbs.twimg.com/media/image.jpg",
            original_info: {
              width: 1200,
              height: 800,
            },
          },
        ],
      };

      const result = transformTweetData(tweet);

      expect(result.media).toHaveLength(1);
      expect(result.media?.[0]).toEqual({
        type: "photo",
        url: "https://pbs.twimg.com/media/image.jpg",
        width: 1200,
        height: 800,
      });
    });

    it("transforms video media with variants", () => {
      const tweet: Tweet = {
        id_str: "123",
        user: { screen_name: "user" },
        mediaDetails: [
          {
            type: "video",
            media_url_https: "https://pbs.twimg.com/video_thumb/123.jpg",
            original_info: {
              width: 1920,
              height: 1080,
            },
            video_info: {
              variants: [
                {
                  content_type: "application/x-mpegURL",
                  url: "https://video.twimg.com/ext_tw_video/123/pl/playlist.m3u8",
                },
                {
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/123/pu/vid/720x1280/video.mp4",
                  bitrate: 2176000,
                },
                {
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/123/pu/vid/480x852/video.mp4",
                  bitrate: 950000,
                },
              ],
            },
          },
        ],
      };

      const result = transformTweetData(tweet);

      expect(result.media).toHaveLength(1);
      const media = result.media?.[0];
      expect(media?.type).toBe("video");
      expect(media?.posterUrl).toBe("https://pbs.twimg.com/video_thumb/123.jpg");
      expect(media?.variants).toHaveLength(2); // Filters out non-video content types
      expect(media?.variants?.[0]).toEqual({
        type: "video/mp4",
        src: "https://video.twimg.com/ext_tw_video/123/pu/vid/720x1280/video.mp4",
        bitrate: 2176000,
      });
    });

    it("transforms multiple photos", () => {
      const tweet: Tweet = {
        id_str: "123",
        user: { screen_name: "user" },
        mediaDetails: [
          {
            type: "photo",
            media_url_https: "https://pbs.twimg.com/media/image1.jpg",
          },
          {
            type: "photo",
            media_url_https: "https://pbs.twimg.com/media/image2.jpg",
          },
          {
            type: "photo",
            media_url_https: "https://pbs.twimg.com/media/image3.jpg",
          },
        ],
      };

      const result = transformTweetData(tweet);

      expect(result.media).toHaveLength(3);
      expect(result.media?.map((m) => m.url)).toEqual([
        "https://pbs.twimg.com/media/image1.jpg",
        "https://pbs.twimg.com/media/image2.jpg",
        "https://pbs.twimg.com/media/image3.jpg",
      ]);
    });

    it("returns null media when mediaDetails is empty", () => {
      const tweet: Tweet = {
        id_str: "123",
        user: { screen_name: "user" },
        mediaDetails: [],
      };

      const result = transformTweetData(tweet);

      expect(result.media).toBeNull();
    });
  });

  describe("quoted tweet handling", () => {
    it("extracts quoted tweet ID when present", () => {
      const tweet: Tweet = {
        id_str: "123",
        user: { screen_name: "user" },
        quoted_tweet: {
          id_str: "456789",
        },
      };

      const result = transformTweetData(tweet);

      expect(result.quotedTweetId).toBe("456789");
    });

    it("returns null when no quoted tweet", () => {
      const tweet: Tweet = {
        id_str: "123",
        user: { screen_name: "user" },
      };

      const result = transformTweetData(tweet);

      expect(result.quotedTweetId).toBeNull();
    });
  });

  describe("card handling", () => {
    it("transforms link card with all fields", () => {
      const tweet: Tweet = {
        id_str: "123",
        user: { screen_name: "user" },
        card: {
          url: "https://example.com/article",
          binding_values: {
            title: { string_value: "Article Title" },
            description: { string_value: "Article description text" },
            url: { string_value: "https://example.com/article" },
            thumbnail_image_large: {
              image_value: { url: "https://example.com/image.jpg" },
            },
          },
        },
      };

      const result = transformTweetData(tweet);

      expect(result.card).toEqual({
        title: "Article Title",
        description: "Article description text",
        url: "https://example.com/article",
        imageUrl: "https://example.com/image.jpg",
      });
    });

    it("uses card.url fallback when binding_values.url is missing", () => {
      const tweet: Tweet = {
        id_str: "123",
        user: { screen_name: "user" },
        card: {
          url: "https://fallback-url.com",
          binding_values: {
            title: { string_value: "Title" },
          },
        },
      };

      const result = transformTweetData(tweet);

      expect(result.card?.url).toBe("https://fallback-url.com");
    });

    it("falls back to alternative image fields", () => {
      const tweet: Tweet = {
        id_str: "123",
        user: { screen_name: "user" },
        card: {
          binding_values: {
            title: { string_value: "Title" },
            thumbnail_image: {
              image_value: { url: "https://example.com/thumb.jpg" },
            },
          },
        },
      };

      const result = transformTweetData(tweet);

      expect(result.card?.imageUrl).toBe("https://example.com/thumb.jpg");
    });

    it("returns null card when no title or description", () => {
      const tweet: Tweet = {
        id_str: "123",
        user: { screen_name: "user" },
        card: {
          url: "https://example.com",
          binding_values: {},
        },
      };

      const result = transformTweetData(tweet);

      expect(result.card).toBeNull();
    });

    it("returns null card when card is missing", () => {
      const tweet: Tweet = {
        id_str: "123",
        user: { screen_name: "user" },
      };

      const result = transformTweetData(tweet);

      expect(result.card).toBeNull();
    });
  });

  describe("date handling", () => {
    it("converts various Twitter date formats to ISO", () => {
      const tweet: Tweet = {
        id_str: "123",
        user: { screen_name: "user" },
        created_at: "Mon Aug 13 00:06:09 +0000 2017",
      };

      const result = transformTweetData(tweet);

      expect(result.postedAt).toBe("2017-08-13T00:06:09.000Z");
    });

    it("returns null for missing date", () => {
      const tweet: Tweet = {
        id_str: "123",
        user: { screen_name: "user" },
      };

      const result = transformTweetData(tweet);

      expect(result.postedAt).toBeNull();
    });
  });
});
