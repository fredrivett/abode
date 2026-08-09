import { describe, expect, it } from "vitest";
import type { InstagramMedia } from "@/lib/types/item";
import { rehostInstagramMedia } from "./rehost-media";

const photo = (url: string): InstagramMedia => ({ type: "photo", url });

describe("rehostInstagramMedia", () => {
  it("re-hosts every photo and picks the cover-index key + size", async () => {
    const media = [
      photo("https://cdn/a"),
      photo("https://cdn/b"),
      photo("https://cdn/c"),
    ];
    const download = async (url: string) => ({
      fileKey: `key-${url.slice(-1)}`,
      size: 100,
    });

    const r = await rehostInstagramMedia(media, 1, download);

    expect(r.media.map((m) => m.fileKey)).toEqual(["key-a", "key-b", "key-c"]);
    expect(r.coverFileKey).toBe("key-b");
    expect(r.coverSize).toBe(100);
    expect(r.storedFileKeys.sort()).toEqual(["key-a", "key-b", "key-c"]);
  });

  it("leaves a failed download without a key and falls back to the first hosted cover", async () => {
    const media = [photo("https://cdn/a"), photo("https://cdn/b")];
    // The cover (index 0) fails to download; index 1 succeeds.
    const download = async (url: string) =>
      url.endsWith("a") ? null : { fileKey: "key-b", size: 50 };

    const r = await rehostInstagramMedia(media, 0, download);

    expect(r.media[0].fileKey).toBeUndefined();
    expect(r.media[1].fileKey).toBe("key-b");
    expect(r.coverFileKey).toBe("key-b");
    expect(r.coverSize).toBe(50);
    expect(r.storedFileKeys).toEqual(["key-b"]);
  });

  it("re-hosts a video's poster, not its playback url", async () => {
    const media: InstagramMedia[] = [
      {
        type: "video",
        url: "https://cdn/video.mp4",
        posterUrl: "https://cdn/poster.jpg",
      },
    ];
    const seen: string[] = [];
    const download = async (url: string) => {
      seen.push(url);
      return { fileKey: "key-p", size: 10 };
    };

    const r = await rehostInstagramMedia(media, 0, download);

    expect(seen).toEqual(["https://cdn/poster.jpg"]);
    expect(r.media[0].fileKey).toBe("key-p");
    expect(r.coverFileKey).toBe("key-p");
  });

  it("returns a null cover when nothing hosts", async () => {
    const r = await rehostInstagramMedia(
      [photo("https://cdn/a")],
      0,
      async () => null,
    );
    expect(r.coverFileKey).toBeNull();
    expect(r.coverSize).toBe(0);
    expect(r.storedFileKeys).toEqual([]);
  });
});
