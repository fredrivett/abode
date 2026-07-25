import { describe, expect, it } from "vitest";
import { twitterImageSrc } from "./image-src";

describe("twitterImageSrc", () => {
  it("serves the re-hosted copy via the proxy when a fileKey exists", () => {
    const src = twitterImageSrc("user/abc.jpg", "https://pbs.twimg.com/x.jpg");
    expect(src).toContain("/api/v1/images/");
    expect(src).toContain(encodeURIComponent("user/abc.jpg"));
    expect(src).not.toContain("twimg");
  });

  it("passes the size preset through to the proxy URL", () => {
    const grid = twitterImageSrc("user/abc.jpg", null, "grid");
    const detail = twitterImageSrc("user/abc.jpg", null, "detail");
    expect(grid).toContain("w=800");
    expect(detail).toContain("w=1800");
  });

  it("falls back to the original twimg URL when there is no fileKey", () => {
    expect(twitterImageSrc(null, "https://pbs.twimg.com/x.jpg")).toBe(
      "https://pbs.twimg.com/x.jpg",
    );
    expect(twitterImageSrc(undefined, "https://pbs.twimg.com/x.jpg")).toBe(
      "https://pbs.twimg.com/x.jpg",
    );
  });

  it("returns undefined when neither a fileKey nor a fallback exists", () => {
    expect(twitterImageSrc(null, null)).toBeUndefined();
    expect(twitterImageSrc(undefined, undefined)).toBeUndefined();
  });
});
