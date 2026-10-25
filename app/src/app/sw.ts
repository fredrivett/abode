import { defaultCache } from "@serwist/next/worker";
import type {
  PrecacheEntry,
  SerwistGlobalConfig,
  SerwistPlugin,
} from "serwist";
import {
  CacheableResponsePlugin,
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
} from "serwist";
import {
  isCachedImageServable,
  isItemImagePath,
  isNoStoreResponse,
  SW_CACHE,
} from "../lib/pwa/sw-caches";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const DAY_SECONDS = 24 * 60 * 60;

const respectNoStore: SerwistPlugin = {
  cacheWillUpdate: async ({ response }) =>
    isNoStoreResponse(response) ? null : response,
};

// A cached image past its visibility window falls through to the network
const imageVisibilityWindow: SerwistPlugin = {
  cachedResponseWillBeUsed: async ({ cachedResponse }) =>
    cachedResponse && isCachedImageServable(cachedResponse, Date.now())
      ? cachedResponse
      : null,
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Ahead of the /api/ rule: item images are keyed by an immutable file key,
    // so a cached copy is served instantly instead of every tile waiting on
    // the network first — within the proxy's visibility window (see
    // isCachedImageServable). Only 200s are cached, so a 403/404 isn't pinned.
    // User-scoped: cleared when the signed-in user changes (session-caches)
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && isItemImagePath(url.pathname),
      handler: new CacheFirst({
        cacheName: SW_CACHE.itemImages,
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          respectNoStore,
          imageVisibilityWindow,
          new ExpirationPlugin({
            maxEntries: 400,
            maxAgeSeconds: 30 * DAY_SECONDS,
            maxAgeFrom: "last-used",
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: SW_CACHE.api,
        networkTimeoutSeconds: 10,
        plugins: [
          // A cacheWillUpdate plugin replaces the strategy's default 200-only check
          new CacheableResponsePlugin({ statuses: [200] }),
          respectNoStore,
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: DAY_SECONDS,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    {
      matcher: ({ url }) =>
        url.hostname.endsWith(".supabase.co") ||
        url.hostname.endsWith(".supabase.com") ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "localhost",
      handler: new NetworkFirst({
        cacheName: SW_CACHE.supabase,
        networkTimeoutSeconds: 10,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: DAY_SECONDS,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    {
      matcher: ({ request }) =>
        request.destination === "style" ||
        request.destination === "script" ||
        request.destination === "font",
      handler: new CacheFirst({
        cacheName: SW_CACHE.staticAssets,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 60,
            maxAgeSeconds: 30 * DAY_SECONDS,
          }),
        ],
      }),
    },
    {
      matcher: ({ request }) => request.destination === "image",
      handler: new CacheFirst({
        cacheName: SW_CACHE.images,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 30 * DAY_SECONDS,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    {
      matcher: ({ request }) => request.destination === "document",
      handler: new NetworkFirst({
        cacheName: SW_CACHE.pages,
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 32,
            maxAgeSeconds: DAY_SECONDS,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
