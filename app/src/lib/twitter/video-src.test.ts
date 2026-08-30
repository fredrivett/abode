import { describe, expect, it } from "vitest";
import type { TwitterMedia } from "@/components/twitter/types";
import { getTwitterVideoSrc } from "./video-src";

const ITEM_ID = "item-1";

function makeMedia(variants: TwitterMedia["variants"]): TwitterMedia {
  return { type: "video", url: "https://example.com/media", variants };
}

function proxied(src: string): string {
  return `/api/v1/twitter-video?itemId=${encodeURIComponent(ITEM_ID)}&url=${encodeURIComponent(src)}`;
}

describe("getTwitterVideoSrc", () => {
  const variants = [
    { type: "video/mp4", src: "https://video.example/low.mp4", bitrate: 256 },
    { type: "video/mp4", src: "https://video.example/high.mp4", bitrate: 2048 },
    { type: "video/mp4", src: "https://video.example/mid.mp4", bitrate: 832 },
    {
      type: "application/x-mpegURL",
      src: "https://video.example/playlist.m3u8",
    },
  ];

  it("picks the highest bitrate mp4 for 'highest'", () => {
    const src = getTwitterVideoSrc({
      media: makeMedia(variants),
      quality: "highest",
      itemId: ITEM_ID,
    });
    expect(src).toBe(proxied("https://video.example/high.mp4"));
  });

  it("picks the lowest bitrate mp4 for 'lowest'", () => {
    const src = getTwitterVideoSrc({
      media: makeMedia(variants),
      quality: "lowest",
      itemId: ITEM_ID,
    });
    expect(src).toBe(proxied("https://video.example/low.mp4"));
  });

  it("scopes the proxy url to the owning item id", () => {
    const src = getTwitterVideoSrc({
      media: makeMedia(variants),
      quality: "highest",
      itemId: ITEM_ID,
    });
    expect(src).toContain(`itemId=${encodeURIComponent(ITEM_ID)}`);
  });

  it("ignores non-mp4 variants when mp4s exist", () => {
    const src = getTwitterVideoSrc({
      media: makeMedia(variants),
      quality: "lowest",
      itemId: ITEM_ID,
    });
    expect(src).not.toContain(encodeURIComponent(".m3u8"));
  });

  it("falls back to non-mp4 variants when no mp4s exist", () => {
    const src = getTwitterVideoSrc({
      media: makeMedia([
        {
          type: "application/x-mpegURL",
          src: "https://video.example/playlist.m3u8",
        },
      ]),
      quality: "highest",
      itemId: ITEM_ID,
    });
    expect(src).toBe(proxied("https://video.example/playlist.m3u8"));
  });

  it("treats missing bitrates as 0", () => {
    const src = getTwitterVideoSrc({
      media: makeMedia([
        { type: "video/mp4", src: "https://video.example/unknown.mp4" },
        {
          type: "video/mp4",
          src: "https://video.example/known.mp4",
          bitrate: 100,
        },
      ]),
      quality: "lowest",
      itemId: ITEM_ID,
    });
    expect(src).toContain(encodeURIComponent("unknown.mp4"));
  });

  it("returns undefined when there are no variants", () => {
    expect(
      getTwitterVideoSrc({
        media: makeMedia([]),
        quality: "highest",
        itemId: ITEM_ID,
      }),
    ).toBeUndefined();
    expect(
      getTwitterVideoSrc({
        media: makeMedia(undefined),
        quality: "lowest",
        itemId: ITEM_ID,
      }),
    ).toBeUndefined();
  });
});
