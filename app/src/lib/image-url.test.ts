import { describe, expect, it } from "vitest";
import {
  getProxyImageUrl,
  type ImageSize,
  imageTransformFor,
  proxyImageSrcSet,
  roomPreviewImageUrl,
} from "./image-url";

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

describe("imageTransformFor", () => {
  const transformOf = (url: string) =>
    imageTransformFor(new URL(url, "http://abode.test").searchParams);

  const sizes: ImageSize[] = ["thumb", "grid", "embed", "detail", "full"];
  const appUrls = [
    ...sizes.flatMap((size) => {
      const src = getProxyImageUrl("k.jpg", size);
      const srcSet = proxyImageSrcSet(src)?.split(", ") ?? [];
      return [src, ...srcSet.map((candidate) => candidate.split(" ")[0])];
    }),
    roomPreviewImageUrl("k.gif"),
  ];

  it.each(appUrls)("serves %s at the size it asks for", (url) => {
    const params = new URL(url, "http://abode.test").searchParams;
    const width = params.get("w");
    expect(transformOf(url)).toEqual(
      width
        ? { width: Number(width), quality: Number(params.get("q")) }
        : undefined,
    );
  });

  it.each([
    ["?w=700&q=75", { width: 800, quality: 80 }],
    ["?w=150&q=76", { width: 200, quality: 75 }],
    ["?w=500&q=85", { width: 600, quality: 90 }],
    ["?w=5000&q=100", { width: 1800, quality: 90 }],
    ["?w=600", { width: 600, quality: 80 }],
  ])(
    "snaps %s up to an app size at least as wide (else the largest)",
    (query, expected) => {
      expect(transformOf(`/api/v1/images/k.jpg${query}`)).toEqual(expected);
    },
  );

  it.each(["", "?q=50", "?h=300", "?w=0", "?w=-400", "?w=abc"])(
    "serves the original for %s",
    (query) => {
      expect(transformOf(`/api/v1/images/k.jpg${query}`)).toBeUndefined();
    },
  );
});
