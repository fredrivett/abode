import {
  imageExtForContentType,
  rehostTwitterImages,
  transformTweetData,
} from "@app/trigger/handle-twitter-url";
import type { Tweet } from "react-tweet/api";
import { describe, expect, it, vi } from "vitest";
import type { TwitterDetails } from "@/components/twitter/types";

const baseDetails: TwitterDetails = {
  tweetId: "1",
  authorName: "A",
  authorUsername: "a",
  authorAvatarUrl: null,
  text: null,
  postedAt: null,
  media: null,
  quotedTweetId: null,
  card: null,
  coverMediaIndex: null,
};

describe("transformTweetData", () => {
  describe("basic tweet fields", () => {
    it("transforms a minimal tweet with required fields", () => {
      const tweet = {
        id_str: "123456789",
        user: {
          screen_name: "testuser",
        },
      } as Tweet;

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
        coverMediaIndex: null,
      });
    });

    it("transforms a complete tweet with all user fields", () => {
      const tweet = {
        id_str: "987654321",
        text: "Hello, world!",
        created_at: "Wed Oct 26 18:45:58 +0000 2022",
        user: {
          name: "Test User",
          screen_name: "testuser",
          profile_image_url_https:
            "https://pbs.twimg.com/profile_images/123.jpg",
        },
      } as Tweet;

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

    it("throws error when user is missing screen_name", () => {
      const tweet = {
        id_str: "123",
        user: {},
      } as Tweet;

      expect(() => transformTweetData(tweet)).toThrow(
        "Tweet 123 is missing author username",
      );
    });

    it("throws error when user is missing entirely", () => {
      const tweet = {
        id_str: "123",
      } as Tweet;

      expect(() => transformTweetData(tweet)).toThrow(
        "Tweet 123 is missing author username",
      );
    });
  });

  describe("media handling", () => {
    it("transforms photo media", () => {
      const tweet = {
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
      } as Tweet;

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
      const tweet = {
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
      } as Tweet;

      const result = transformTweetData(tweet);

      expect(result.media).toHaveLength(1);
      const media = result.media?.[0];
      expect(media?.type).toBe("video");
      expect(media?.posterUrl).toBe(
        "https://pbs.twimg.com/video_thumb/123.jpg",
      );
      expect(media?.variants).toHaveLength(2); // Filters out non-video content types
      expect(media?.variants?.[0]).toEqual({
        type: "video/mp4",
        src: "https://video.twimg.com/ext_tw_video/123/pu/vid/720x1280/video.mp4",
        bitrate: 2176000,
      });
    });

    it("transforms multiple photos", () => {
      const tweet = {
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
      } as Tweet;

      const result = transformTweetData(tweet);

      expect(result.media).toHaveLength(3);
      expect(result.media?.map((m) => m.url)).toEqual([
        "https://pbs.twimg.com/media/image1.jpg",
        "https://pbs.twimg.com/media/image2.jpg",
        "https://pbs.twimg.com/media/image3.jpg",
      ]);
    });

    it("returns null media when mediaDetails is empty", () => {
      const tweet = {
        id_str: "123",
        user: { screen_name: "user" },
        mediaDetails: [],
      } as unknown as Tweet;

      const result = transformTweetData(tweet);

      expect(result.media).toBeNull();
    });
  });

  describe("quoted tweet handling", () => {
    it("extracts quoted tweet ID when present", () => {
      const tweet = {
        id_str: "123",
        user: { screen_name: "user" },
        quoted_tweet: {
          id_str: "456789",
        },
      } as Tweet;

      const result = transformTweetData(tweet);

      expect(result.quotedTweetId).toBe("456789");
    });

    it("returns null when no quoted tweet", () => {
      const tweet = {
        id_str: "123",
        user: { screen_name: "user" },
      } as Tweet;

      const result = transformTweetData(tweet);

      expect(result.quotedTweetId).toBeNull();
    });
  });

  describe("card handling", () => {
    it("transforms link card with all fields", () => {
      const tweet = {
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
      } as unknown as Tweet;

      const result = transformTweetData(tweet);

      expect(result.card).toEqual({
        title: "Article Title",
        description: "Article description text",
        url: "https://example.com/article",
        imageUrl: "https://example.com/image.jpg",
      });
    });

    it("uses card.url fallback when binding_values.url is missing", () => {
      const tweet = {
        id_str: "123",
        user: { screen_name: "user" },
        card: {
          url: "https://fallback-url.com",
          binding_values: {
            title: { string_value: "Title" },
          },
        },
      } as unknown as Tweet;

      const result = transformTweetData(tweet);

      expect(result.card?.url).toBe("https://fallback-url.com");
    });

    it("falls back to alternative image fields", () => {
      const tweet = {
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
      } as unknown as Tweet;

      const result = transformTweetData(tweet);

      expect(result.card?.imageUrl).toBe("https://example.com/thumb.jpg");
    });

    it("returns null card when no title or description", () => {
      const tweet = {
        id_str: "123",
        user: { screen_name: "user" },
        card: {
          url: "https://example.com",
          binding_values: {},
        },
      } as unknown as Tweet;

      const result = transformTweetData(tweet);

      expect(result.card).toBeNull();
    });

    it("returns null card when card is missing", () => {
      const tweet = {
        id_str: "123",
        user: { screen_name: "user" },
      } as Tweet;

      const result = transformTweetData(tweet);

      expect(result.card).toBeNull();
    });
  });

  describe("date handling", () => {
    it("converts various Twitter date formats to ISO", () => {
      const tweet = {
        id_str: "123",
        user: { screen_name: "user" },
        created_at: "Mon Aug 13 00:06:09 +0000 2017",
      } as Tweet;

      const result = transformTweetData(tweet);

      expect(result.postedAt).toBe("2017-08-13T00:06:09.000Z");
    });

    it("returns null for missing date", () => {
      const tweet = {
        id_str: "123",
        user: { screen_name: "user" },
      } as Tweet;

      const result = transformTweetData(tweet);

      expect(result.postedAt).toBeNull();
    });
  });
});

describe("imageExtForContentType", () => {
  it("maps supported raster formats to an extension", () => {
    expect(imageExtForContentType("image/jpeg")).toBe(".jpg");
    expect(imageExtForContentType("image/png")).toBe(".png");
    expect(imageExtForContentType("image/gif")).toBe(".gif");
    expect(imageExtForContentType("image/webp")).toBe(".webp");
  });

  it("ignores charset params and casing", () => {
    expect(imageExtForContentType("IMAGE/JPEG; charset=binary")).toBe(".jpg");
  });

  it("rejects SVG (would be served as same-origin active content)", () => {
    expect(imageExtForContentType("image/svg+xml")).toBeNull();
  });

  it("rejects unknown or empty content-types", () => {
    expect(imageExtForContentType("image/avif")).toBeNull();
    expect(imageExtForContentType("text/html")).toBeNull();
    expect(imageExtForContentType("")).toBeNull();
  });
});

describe("rehostTwitterImages", () => {
  // Deterministic downloader: derives a stable key/size from the URL.
  const fakeDownload = (url: string) =>
    Promise.resolve({ fileKey: `key/${url.split("/").pop()}`, size: 100 });

  it("re-hosts photo stills and attaches fileKeys", async () => {
    const details: TwitterDetails = {
      ...baseDetails,
      media: [
        { type: "photo", url: "https://pbs.twimg.com/a.jpg" },
        { type: "photo", url: "https://pbs.twimg.com/b.jpg" },
      ],
    };

    const result = await rehostTwitterImages(details, fakeDownload);

    expect(result.media?.map((m) => m.fileKey)).toEqual([
      "key/a.jpg",
      "key/b.jpg",
    ]);
    // Original twimg URL is preserved as a fallback
    expect(result.media?.[0].url).toBe("https://pbs.twimg.com/a.jpg");
    expect(result.storedFileKeys).toEqual(["key/a.jpg", "key/b.jpg"]);
  });

  it("re-hosts the video poster (not the video bytes)", async () => {
    const details: TwitterDetails = {
      ...baseDetails,
      media: [
        {
          type: "video",
          url: "https://pbs.twimg.com/vid.jpg",
          posterUrl: "https://pbs.twimg.com/poster.jpg",
          variants: [{ type: "video/mp4", src: "https://video/x.mp4" }],
        },
      ],
    };

    const download = vi.fn(fakeDownload);
    const result = await rehostTwitterImages(details, download);

    // Only the poster is downloaded — never the mp4 variant
    expect(download).toHaveBeenCalledExactlyOnceWith(
      "https://pbs.twimg.com/poster.jpg",
    );
    expect(result.media?.[0].fileKey).toBe("key/poster.jpg");
  });

  it("re-hosts the link-card image", async () => {
    const details: TwitterDetails = {
      ...baseDetails,
      card: {
        title: "t",
        description: "d",
        url: "https://ex.com",
        imageUrl: "https://ex.com/card.jpg",
      },
    };

    const result = await rehostTwitterImages(details, fakeDownload);

    expect(result.card?.imageFileKey).toBe("key/card.jpg");
    expect(result.coverFileKey).toBe("key/card.jpg");
  });

  it("selects the cover from coverMediaIndex, sized accordingly", async () => {
    const details: TwitterDetails = {
      ...baseDetails,
      coverMediaIndex: 1,
      media: [
        { type: "photo", url: "https://pbs.twimg.com/a.jpg" },
        { type: "photo", url: "https://pbs.twimg.com/b.jpg" },
      ],
    };

    const result = await rehostTwitterImages(details, fakeDownload);

    expect(result.coverFileKey).toBe("key/b.jpg");
    expect(result.coverSize).toBe(100);
  });

  it("is best-effort: a failed download leaves the original url and no key", async () => {
    const details: TwitterDetails = {
      ...baseDetails,
      media: [
        { type: "photo", url: "https://pbs.twimg.com/ok.jpg" },
        { type: "photo", url: "https://pbs.twimg.com/bad.jpg" },
      ],
    };

    const download = (url: string) =>
      url.includes("bad") ? Promise.resolve(null) : fakeDownload(url);

    const result = await rehostTwitterImages(details, download);

    expect(result.media?.[0].fileKey).toBe("key/ok.jpg");
    expect(result.media?.[1].fileKey).toBeUndefined();
    expect(result.media?.[1].url).toBe("https://pbs.twimg.com/bad.jpg");
    expect(result.storedFileKeys).toEqual(["key/ok.jpg"]);
  });

  it("returns null media and no cover when there is nothing to host", async () => {
    const download = vi.fn(fakeDownload);
    const result = await rehostTwitterImages(baseDetails, download);

    expect(download).not.toHaveBeenCalled();
    expect(result.media).toBeNull();
    expect(result.coverFileKey).toBeNull();
    expect(result.coverSize).toBe(0);
    expect(result.storedFileKeys).toEqual([]);
  });
});
