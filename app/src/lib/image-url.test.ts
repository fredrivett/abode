import { describe, expect, it } from "vitest";
import { getProxyImageUrl, proxyImageSrcSet } from "./image-url";

describe("proxyImageSrcSet", () => {
  it("offers smaller renditions up to the URL's own width", () => {
    const src = getProxyImageUrl("u/cover.jpg", "grid");
    expect(proxyImageSrcSet(src)).toBe(
      [
        "/api/v1/images/u%2Fcover.jpg?w=400&q=80 400w",
        "/api/v1/images/u%2Fcover.jpg?w=600&q=80 600w",
        "/api/v1/images/u%2Fcover.jpg?w=800&q=80 800w",
      ].join(", "),
    );
  });

  it("never offers more than the URL's own width", () => {
    expect(proxyImageSrcSet("/api/v1/images/k.jpg?w=500&q=80")).toBe(
      "/api/v1/images/k.jpg?w=400&q=80 400w, /api/v1/images/k.jpg?w=500&q=80 500w",
    );
    expect(
      proxyImageSrcSet(getProxyImageUrl("k.jpg", "thumb")),
    ).toBeUndefined();
  });

  it.each([
    ["an unresized original", getProxyImageUrl("k.jpg", "full")],
    ["a GIF (served untransformed)", getProxyImageUrl("k.gif", "grid")],
    ["a blob URL", "blob:https://abode.test/123"],
    ["a third-party URL", "https://pbs.twimg.com/media/x.jpg?w=800"],
  ])("skips %s", (_label, src) => {
    expect(proxyImageSrcSet(src)).toBeUndefined();
  });
});
