import { describe, expect, it } from "vitest";
import type { TwitterMedia } from "@/lib/types/item";
import { reconcileTweetMedia } from "./item-inspector";

const photo = (url: string, fileKey?: string): TwitterMedia => ({
  type: "photo",
  url,
  ...(fileKey && { fileKey }),
});

describe("reconcileTweetMedia", () => {
  it("flags the cover, the mirrored analysis, and per-media state", () => {
    const media = [
      photo("https://t/a.jpg", "u/a.jpg"),
      photo("https://t/b.jpg", "u/b.jpg"),
      photo("https://t/c.jpg", "u/c.jpg"),
      photo("https://t/d.jpg"), // not re-hosted
    ];
    const rows = reconcileTweetMedia(media, 1, "u/b.jpg", [
      { fileKey: "u/a.jpg", embeddingModel: "clip-vit-base-patch32" },
      { fileKey: "u/b.jpg", embeddingModel: "clip-vit-base-patch32" },
      { fileKey: "u/c.jpg", embeddingModel: null }, // analysed, no embedding
    ]);

    expect(rows[0]).toMatchObject({
      index: 0,
      rehosted: true,
      analysed: true,
      hasEmbedding: true,
      isCover: false,
      isMirrored: false,
    });
    // index 1 is the selected cover, and its analysis is the mirrored one
    expect(rows[1]).toMatchObject({
      isCover: true,
      isMirrored: true,
      analysed: true,
      hasEmbedding: true,
    });
    // analysed but embedding missing
    expect(rows[2]).toMatchObject({ analysed: true, hasEmbedding: false });
    // not re-hosted → not analysed
    expect(rows[3]).toMatchObject({
      rehosted: false,
      analysed: false,
      hasEmbedding: false,
    });
  });

  it("defaults a null coverMediaIndex to the first image", () => {
    const rows = reconcileTweetMedia(
      [
        photo("https://t/a.jpg", "u/a.jpg"),
        photo("https://t/b.jpg", "u/b.jpg"),
      ],
      null,
      "u/a.jpg",
      [{ fileKey: "u/a.jpg", embeddingModel: "clip-vit-base-patch32" }],
    );
    expect(rows[0].isCover).toBe(true);
    expect(rows[1].isCover).toBe(false);
  });

  it("surfaces cover/mirror drift: displayed cover differs from mirrored", () => {
    // coverMediaIndex points at #1, but coverFileKey still references #0's key
    const rows = reconcileTweetMedia(
      [
        photo("https://t/a.jpg", "u/a.jpg"),
        photo("https://t/b.jpg", "u/b.jpg"),
      ],
      1,
      "u/a.jpg",
      [
        { fileKey: "u/a.jpg", embeddingModel: "clip-vit-base-patch32" },
        { fileKey: "u/b.jpg", embeddingModel: "clip-vit-base-patch32" },
      ],
    );
    expect(rows[0]).toMatchObject({ isCover: false, isMirrored: true });
    expect(rows[1]).toMatchObject({ isCover: true, isMirrored: false });
  });
});
