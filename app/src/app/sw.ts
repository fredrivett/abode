import { defaultCache } from "@serwist/next/worker";
import type {
  PrecacheEntry,
  SerwistGlobalConfig,
  SerwistPlugin,
} from "serwist";
import {
  BackgroundSyncQueue,
  CacheableResponsePlugin,
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
} from "serwist";
import {
  isClearShareQueueMessage,
  isReplayShareQueueMessage,
  QUEUED_SHARE_PAGE,
  queuedSaveRequest,
  SHARE_QUEUE_NAME,
  sharedUrlFromSaveUrl,
  shouldRetryReplayedSave,
} from "../lib/pwa/share-queue";
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
const OFFLINE_PAGE = "/~offline";

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

// Replays queued saves in order, stopping at the first that can't go through
// yet (offline, signed out, server error) so it's retried on the next sync
async function replayShares(queue: BackgroundSyncQueue): Promise<void> {
  for (
    let entry = await queue.shiftRequest();
    entry;
    entry = await queue.shiftRequest()
  ) {
    let status: number | null = null;
    try {
      status = (await fetch(entry.request.clone())).status;
    } catch {
      // Still offline
    }
    if (status === null || shouldRetryReplayedSave(status)) {
      await queue.unshiftRequest(entry);
      // Rejecting tells Background Sync to try again later
      throw new Error("Queued share not saved yet");
    }
  }
}

async function clearShares(queue: BackgroundSyncQueue): Promise<void> {
  while (await queue.shiftRequest()) {
    // Dropped unsent
  }
}

// Share-sheet saves made offline, replayed once there's a connection (Background
// Sync where supported, else the next time the service worker starts)
const shareQueue = new BackgroundSyncQueue(SHARE_QUEUE_NAME, {
  maxRetentionTime: 7 * 24 * 60, // minutes
  onSync: ({ queue }) => replayShares(queue),
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // A share opened with no connection would otherwise hit the offline page
    // and be lost: queue the save `/save` would have made, then say so
    {
      matcher: ({ request, url, sameOrigin }) =>
        sameOrigin && request.mode === "navigate" && url.pathname === "/save",
      handler: async ({ request, url, event }): Promise<Response> => {
        try {
          const preloaded =
            "preloadResponse" in event
              ? await event.preloadResponse
              : undefined;
          return preloaded instanceof Response
            ? preloaded
            : await fetch(request);
        } catch {
          const sharedUrl = sharedUrlFromSaveUrl(url);
          if (!sharedUrl) {
            return (
              (await serwist.matchPrecache(OFFLINE_PAGE)) ?? Response.error()
            );
          }
          await shareQueue.pushRequest({
            request: queuedSaveRequest({ origin: url.origin, sharedUrl }),
          });
          return Response.redirect(QUEUED_SHARE_PAGE, 303);
        }
      },
    },
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
      // Cross-origin only: local Supabase runs on its own port, and matching
      // our own origin on localhost would swallow every app request
      matcher: ({ url, sameOrigin }) =>
        !sameOrigin &&
        (url.hostname.endsWith(".supabase.co") ||
          url.hostname.endsWith(".supabase.com") ||
          url.hostname === "127.0.0.1" ||
          url.hostname === "localhost"),
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
        url: OFFLINE_PAGE,
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

self.addEventListener("message", (event) => {
  if (isReplayShareQueueMessage(event.data)) {
    event.waitUntil(replayShares(shareQueue).catch(() => {}));
  } else if (isClearShareQueueMessage(event.data)) {
    event.waitUntil(clearShares(shareQueue));
  }
});
