import { extractSharedUrl } from "../share-target";

/** Background sync queue holding share-sheet saves made while offline */
export const SHARE_QUEUE_NAME = "share-target-saves";

/** Where an offline share lands: the offline page, told the save is queued */
export const QUEUED_SHARE_HASH = "#share-queued";
export const QUEUED_SHARE_PAGE = `/~offline${QUEUED_SHARE_HASH}`;

/**
 * Sent by the offline page when the connection returns, so queued shares are
 * saved straight away rather than whenever the browser fires Background Sync
 */
export const REPLAY_SHARE_QUEUE_MESSAGE = {
  type: "replay-share-queue",
} as const;

/**
 * Sent when the signed-in user changes (see session-caches): queued saves
 * replay with whoever's cookies are current, so one user's offline shares must
 * never be left for the next account on the device
 */
export const CLEAR_SHARE_QUEUE_MESSAGE = { type: "clear-share-queue" } as const;

function isMessage(data: unknown, type: string): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === type
  );
}

export function isReplayShareQueueMessage(data: unknown): boolean {
  return isMessage(data, REPLAY_SHARE_QUEUE_MESSAGE.type);
}

export function isClearShareQueueMessage(data: unknown): boolean {
  return isMessage(data, CLEAR_SHARE_QUEUE_MESSAGE.type);
}

/**
 * Whether a replayed save should stay queued: signed out (the session may have
 * expired while offline, so it's kept for the next sign-in), rate limited (the
 * daily save cap resets), or a server error. Anything else — saved, or
 * rejected as invalid — is done with
 */
export function shouldRetryReplayedSave(status: number): boolean {
  return status === 401 || status === 429 || status >= 500;
}

/** The link a `/save` navigation shares, read the same way the page reads it */
export function sharedUrlFromSaveUrl(url: URL): string | null {
  if (url.pathname !== "/save") return null;
  const param = (name: string) => url.searchParams.get(name) ?? undefined;
  return extractSharedUrl({
    url: param("url"),
    text: param("text"),
    title: param("title"),
  });
}

/**
 * The save `/save` would have made (see `SaveRedirect`), for the service worker
 * to queue and replay with the user's cookies once back online
 */
export function queuedSaveRequest({
  origin,
  sharedUrl,
}: {
  origin: string;
  sharedUrl: string;
}): Request {
  return new Request(new URL("/api/v1/items/from-url", origin), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: sharedUrl, source: "share_target" }),
    credentials: "same-origin",
  });
}
