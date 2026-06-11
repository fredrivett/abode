import { describe, expect, it } from "vitest";
import type { TwitterMedia } from "@/components/twitter/types";
import { getTwitterVideoSrc } from "./video-src";

function makeMedia(variants: TwitterMedia["variants"]): TwitterMedia {
  return { type: "video", url: "https://example.com/media", variants };
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
    const src = getTwitterVideoSrc(makeMedia(variants), "highest");
    expect(src).toBe(
      `/api/v1/twitter-video?url=${encodeURIComponent("https://video.example/high.mp4")}`,
    );
  });

  it("picks the lowest bitrate mp4 for 'lowest'", () => {
    const src = getTwitterVideoSrc(makeMedia(variants), "lowest");
    expect(src).toBe(
      `/api/v1/twitter-video?url=${encodeURIComponent("https://video.example/low.mp4")}`,
    );
  });

  it("ignores non-mp4 variants when mp4s exist", () => {
    const src = getTwitterVideoSrc(makeMedia(variants), "lowest");
    expect(src).not.toContain(encodeURIComponent(".m3u8"));
  });

  it("falls back to non-mp4 variants when no mp4s exist", () => {
    const src = getTwitterVideoSrc(
      makeMedia([
        {
          type: "application/x-mpegURL",
          src: "https://video.example/playlist.m3u8",
        },
      ]),
      "highest",
    );
    expect(src).toBe(
      `/api/v1/twitter-video?url=${encodeURIComponent("https://video.example/playlist.m3u8")}`,
    );
  });

  it("treats missing bitrates as 0", () => {
    const src = getTwitterVideoSrc(
      makeMedia([
        { type: "video/mp4", src: "https://video.example/unknown.mp4" },
        {
          type: "video/mp4",
          src: "https://video.example/known.mp4",
          bitrate: 100,
        },
      ]),
      "lowest",
    );
    expect(src).toContain(encodeURIComponent("unknown.mp4"));
  });

  it("returns undefined when there are no variants", () => {
    expect(getTwitterVideoSrc(makeMedia([]), "highest")).toBeUndefined();
    expect(getTwitterVideoSrc(makeMedia(undefined), "lowest")).toBeUndefined();
  });
});
