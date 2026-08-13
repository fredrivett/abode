import { describe, expect, it } from "vitest";
import { hasKindSpecificCardContent } from "./kind-specific-card-content";

const base = {
  kind: "twitter" as const,
  hasTwitterDetails: false,
  hasInstagramDetails: false,
  hasVideoDetails: false,
};

describe("hasKindSpecificCardContent", () => {
  it("is true for a processing tweet once its detail row exists", () => {
    expect(
      hasKindSpecificCardContent({ ...base, hasTwitterDetails: true }),
    ).toBe(true);
  });

  it("is false for a tweet before its detail row exists", () => {
    expect(hasKindSpecificCardContent(base)).toBe(false);
  });

  it("is true for instagram/video once their detail row exists", () => {
    expect(
      hasKindSpecificCardContent({
        ...base,
        kind: "instagram",
        hasInstagramDetails: true,
      }),
    ).toBe(true);
    expect(
      hasKindSpecificCardContent({
        ...base,
        kind: "video",
        hasVideoDetails: true,
      }),
    ).toBe(true);
  });

  it("is false for instagram/video before their detail row exists", () => {
    expect(hasKindSpecificCardContent({ ...base, kind: "instagram" })).toBe(
      false,
    );
    expect(hasKindSpecificCardContent({ ...base, kind: "video" })).toBe(false);
  });

  it("is always true for notes", () => {
    expect(hasKindSpecificCardContent({ ...base, kind: "note" })).toBe(true);
  });

  it("is false while the kind is still unresolved (URL not yet classified)", () => {
    expect(hasKindSpecificCardContent({ ...base, kind: null })).toBe(false);
  });

  it("does not match a detail row against the wrong kind", () => {
    // A stale twitterDetails must not qualify an item now classified as video
    expect(
      hasKindSpecificCardContent({
        ...base,
        kind: "video",
        hasTwitterDetails: true,
      }),
    ).toBe(false);
  });

  it("is false for cover-based web kinds (they gate on previewUrl, not this)", () => {
    for (const kind of ["article", "webpage", "product", "book"] as const) {
      expect(hasKindSpecificCardContent({ ...base, kind })).toBe(false);
    }
  });
});
