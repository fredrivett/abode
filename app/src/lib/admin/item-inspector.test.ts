import { describe, expect, it } from "vitest";
import type { TwitterMedia } from "@/lib/types/item";
import { annotateSimilar, reconcileTweetMedia } from "./item-inspector";

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

describe("annotateSimilar", () => {
  const rows = (scores: number[]) =>
    scores.map((similarity) => ({ similarity }));

  it("flags threshold and shown-to-user (within the display cap)", () => {
    const out = annotateSimilar(rows([0.9, 0.8, 0.75, 0.6, 0.5]), 0.7, 6);
    expect(out.map((r) => r.meetsThreshold)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(out.map((r) => r.shownToUser)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
  });

  it("caps shown-to-user at the display limit even when more pass", () => {
    const out = annotateSimilar(rows([0.9, 0.85, 0.8]), 0.7, 2);
    expect(out.map((r) => r.meetsThreshold)).toEqual([true, true, true]);
    expect(out.map((r) => r.shownToUser)).toEqual([true, true, false]);
  });

  it("marks nothing shown when all fall below the threshold", () => {
    const out = annotateSimilar(rows([0.6, 0.4]), 0.7, 6);
    expect(out.every((r) => !r.meetsThreshold && !r.shownToUser)).toBe(true);
  });
});
