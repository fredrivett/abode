import { describe, expect, it } from "vitest";
import { imageSrcForAttempt, isRetryableImageSrc } from "./image-retry";

describe("isRetryableImageSrc", () => {
  it.each([
    "/api/v1/images/u%2Fcover.jpg?w=640&q=80",
    "/api/v1/map-image?lat=1&lng=2",
    "/gallery/photo.jpg",
  ])("retries same-origin %s", (src) => {
    expect(isRetryableImageSrc(src)).toBe(true);
  });

  it.each([
    "https://pbs.twimg.com/media/abc.jpg",
    "//cdn.example.com/a.jpg",
    "blob:http://localhost:3300/1234",
    "data:image/png;base64,AAAA",
  ])("doesn't retry %s", (src) => {
    expect(isRetryableImageSrc(src)).toBe(false);
  });
});

describe("imageSrcForAttempt", () => {
  it("leaves the first attempt untouched", () => {
    expect(imageSrcForAttempt({ src: "/a.jpg?w=640", attempt: 0 })).toBe(
      "/a.jpg?w=640",
    );
  });

  it("appends a cache-busting param to retries", () => {
    expect(imageSrcForAttempt({ src: "/a.jpg?w=640", attempt: 1 })).toBe(
      "/a.jpg?w=640&retry=1",
    );
    expect(imageSrcForAttempt({ src: "/a.jpg", attempt: 2 })).toBe(
      "/a.jpg?retry=2",
    );
  });
});
