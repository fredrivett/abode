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
