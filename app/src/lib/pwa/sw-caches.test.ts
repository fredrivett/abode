import { describe, expect, it } from "vitest";
import {
  isCachedImageServable,
  isItemImagePath,
  isNoStoreResponse,
  isUserScopedCache,
  SW_CACHE,
} from "./sw-caches";

describe("isUserScopedCache", () => {
  it.each([
    SW_CACHE.api,
    SW_CACHE.itemImages,
    SW_CACHE.images,
    SW_CACHE.pages,
    SW_CACHE.supabase,
    "pages-rsc",
    "pages-rsc-prefetch",
    "apis",
    "others",
    "cross-origin",
    "some-future-cache",
  ])("treats %s as user-scoped", (name) => {
    expect(isUserScopedCache(name)).toBe(true);
  });

  it.each([
    "serwist-precache-v2-https://www.abode.fyi/",
    SW_CACHE.staticAssets,
    "static-js-assets",
    "next-static-js-assets",
    "google-fonts-webfonts",
  ])("keeps shared build cache %s", (name) => {
    expect(isUserScopedCache(name)).toBe(false);
  });
});

describe("isItemImagePath", () => {
  it.each([
    ["/api/v1/images/u%2Fcover.jpg", true],
    ["/api/v1/map-image", false],
    ["/api/v1/items", false],
    ["/images/logo.png", false],
  ])("%s → %s", (path, expected) => {
    expect(isItemImagePath(path)).toBe(expected);
  });
});

describe("isNoStoreResponse", () => {
  const withCacheControl = (value: string | null) =>
    new Response("", value ? { headers: { "Cache-Control": value } } : {});

  it.each([
    ["no-store", true],
    ["private, no-store", true],
    ["no-cache, no-store, must-revalidate", true],
    ["public, max-age=3600, s-maxage=3600", false],
    ["private, max-age=3600", false],
    [null, false],
  ])("%s → %s", (value, expected) => {
    expect(isNoStoreResponse(withCacheControl(value))).toBe(expected);
  });
});

describe("isCachedImageServable", () => {
  const fetchedAt = Date.parse("2026-10-25T12:00:00Z");
  const cached = (
    cacheControl: string,
    date: string | null = "Sun, 25 Oct 2026 12:00:00 GMT",
  ) =>
    new Response("", {
      headers: {
        "Cache-Control": cacheControl,
        ...(date ? { Date: date } : {}),
      },
    });
  const HOUR = 60 * 60 * 1000;

  it("serves an owner-only image whatever its age", () => {
    expect(
      isCachedImageServable(
        cached("private, max-age=3600"),
        fetchedAt + 30 * 24 * HOUR,
      ),
    ).toBe(true);
  });

  it("serves a public image within its max-age", () => {
    expect(
      isCachedImageServable(
        cached("public, max-age=3600, s-maxage=3600"),
        fetchedAt + HOUR / 2,
      ),
    ).toBe(true);
  });

  it("re-checks a public image once its max-age runs out", () => {
    expect(
      isCachedImageServable(
        cached("public, max-age=3600, s-maxage=3600"),
        fetchedAt + HOUR,
      ),
    ).toBe(false);
  });

  it("re-checks when the age can't be worked out", () => {
    expect(
      isCachedImageServable(cached("public, max-age=3600", null), fetchedAt),
    ).toBe(false);
    expect(isCachedImageServable(cached("public"), fetchedAt)).toBe(false);
  });
});
