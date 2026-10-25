import { describe, expect, it } from "vitest";
import {
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
