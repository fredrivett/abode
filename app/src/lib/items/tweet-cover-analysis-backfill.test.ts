import { describe, expect, it } from "vitest";
import { coverNeedsAnalysis } from "./tweet-cover-analysis-backfill";

describe("coverNeedsAnalysis", () => {
  it("needs analysis when nothing is cached", () => {
    expect(coverNeedsAnalysis("u/cover.jpg", [])).toBe(true);
  });

  it("needs analysis when only an old cover is cached", () => {
    // A stale row for a previous cover must not exclude the current one
    expect(coverNeedsAnalysis("u/new.jpg", ["u/old.jpg"])).toBe(true);
  });

  it("does not need analysis when the current cover is cached", () => {
    expect(
      coverNeedsAnalysis("u/cover.jpg", ["u/old.jpg", "u/cover.jpg"]),
    ).toBe(false);
  });
});
