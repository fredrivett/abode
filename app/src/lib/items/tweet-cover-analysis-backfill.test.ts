import { describe, expect, it } from "vitest";
import { coverNeedsAnalysis } from "./tweet-cover-analysis-backfill";

const withEmbedding = (fileKey: string) => ({
  fileKey,
  embeddingModel: "clip-vit-base-patch32",
});
const withoutEmbedding = (fileKey: string) => ({
  fileKey,
  embeddingModel: null,
});

describe("coverNeedsAnalysis", () => {
  it("needs analysis when nothing is cached", () => {
    expect(coverNeedsAnalysis("u/cover.jpg", [], true)).toBe(true);
  });

  it("needs analysis when only an old cover is cached", () => {
    // A stale row for a previous cover must not exclude the current one
    expect(
      coverNeedsAnalysis("u/new.jpg", [withEmbedding("u/old.jpg")], true),
    ).toBe(true);
  });

  it("does not need analysis when the current cover is fully analysed", () => {
    expect(
      coverNeedsAnalysis(
        "u/cover.jpg",
        [withEmbedding("u/old.jpg"), withEmbedding("u/cover.jpg")],
        true,
      ),
    ).toBe(false);
  });

  it("re-selects a cached cover whose embedding never landed", () => {
    // A throttled Replicate call left a row with no embedding — heal it on re-run
    expect(
      coverNeedsAnalysis(
        "u/cover.jpg",
        [withoutEmbedding("u/cover.jpg")],
        true,
      ),
    ).toBe(true);
  });

  it("does not re-select a missing embedding when Replicate is unconfigured", () => {
    // Without Replicate a null embedding is the final state — don't spin
    expect(
      coverNeedsAnalysis(
        "u/cover.jpg",
        [withoutEmbedding("u/cover.jpg")],
        false,
      ),
    ).toBe(false);
  });
});
