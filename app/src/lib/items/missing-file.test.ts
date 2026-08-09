import { describe, expect, it } from "vitest";
import { shouldShowMissingFile } from "./missing-file";

const base = {
  kind: "image" as const,
  hasImageFileKey: false,
  isProcessingUrl: false,
  isFailedUrl: false,
};

describe("shouldShowMissingFile", () => {
  it("flags a completed image with no file", () => {
    expect(shouldShowMissingFile(base)).toBe(true);
  });

  it("never flags when a file is present", () => {
    expect(shouldShowMissingFile({ ...base, hasImageFileKey: true })).toBe(
      false,
    );
  });

  it("does not flag while the kind is still unresolved (completion race)", () => {
    expect(shouldShowMissingFile({ ...base, kind: null })).toBe(false);
  });

  it("does not flag custom-card / cover-based kinds", () => {
    for (const kind of [
      "instagram",
      "twitter",
      "video",
      "article",
      "webpage",
      "product",
      "book",
      "note",
    ] as const) {
      expect(shouldShowMissingFile({ ...base, kind })).toBe(false);
    }
  });

  it("does not flag while processing or failed", () => {
    expect(shouldShowMissingFile({ ...base, isProcessingUrl: true })).toBe(
      false,
    );
    expect(shouldShowMissingFile({ ...base, isFailedUrl: true })).toBe(false);
  });
});
