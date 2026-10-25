/**
 * Cache Storage names shared by the service worker (`src/app/sw.ts`) and the
 * page, which clears per-user caches when the signed-in user changes.
 */
export const SW_CACHE = {
  /** Item images via the same-origin proxy (`/api/v1/images`) */
  itemImages: "item-images",
  api: "api-cache",
  supabase: "supabase-cache",
  staticAssets: "static-assets",
  images: "images",
  pages: "pages",
} as const;

/** The image proxy, whose URLs are keyed by an immutable (random-UUID) file key */
export function isItemImagePath(pathname: string): boolean {
  return pathname.startsWith("/api/v1/images/");
}

/**
 * Whether a response opted out of storage (e.g. the map image, which pins an
 * exact location). Runtime caching ignores `Cache-Control`, so routes that say
 * `no-store` are kept out of Cache Storage explicitly.
 */
export function isNoStoreResponse(response: Response): boolean {
  return /(^|,)\s*no-store\s*(,|$)/i.test(
    response.headers.get("Cache-Control") ?? "",
  );
}

/**
 * Whether a cached image proxy response may still be served without asking
 * the server. The proxy re-checks visibility on every request and lets
 * browsers keep a viewable image for its `max-age`, so the service worker
 * keeps to the same window: a `public` image (visible to anyone while shared)
 * is re-fetched once that runs out, so unsharing takes effect as fast as it
 * does for the browser cache. A `private` one is visible only to its owner,
 * who can always see it, so it's served until it expires from the cache —
 * which is cleared when the signed-in user changes.
 */
export function isCachedImageServable(
  response: Response,
  now: number,
): boolean {
  const cacheControl = response.headers.get("Cache-Control") ?? "";
  if (/(^|,)\s*private\s*(,|$)/i.test(cacheControl)) return true;
  const maxAge = /(?:^|,)\s*max-age=(\d+)/i.exec(cacheControl);
  const fetchedAt = Date.parse(response.headers.get("Date") ?? "");
  if (!maxAge || Number.isNaN(fetchedAt)) return false;
  return now - fetchedAt < Number(maxAge[1]) * 1000;
}

// Caches that only ever hold public build output, kept across sign-out. Deny
// by default: anything not listed (including a cache added later) is treated
// as holding the signed-in user's data
const SHARED_CACHE_NAMES: ReadonlySet<string> = new Set([
  SW_CACHE.staticAssets,
  "static-js-assets",
  "static-style-assets",
  "static-font-assets",
  "next-static-js-assets",
  "google-fonts-stylesheets",
  "google-fonts-webfonts",
]);

const PRECACHE_PREFIX = "serwist-precache";

/** Whether a cache may hold the signed-in user's responses (pages, API data, item images) */
export function isUserScopedCache(name: string): boolean {
  return !name.startsWith(PRECACHE_PREFIX) && !SHARED_CACHE_NAMES.has(name);
}
