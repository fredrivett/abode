import { isUserScopedCache } from "./sw-caches";

/** Who the service worker's user-scoped caches currently belong to */
const CACHE_OWNER_KEY = "abode:sw-cache-owner";

function readOwner(): string | null {
  try {
    return localStorage.getItem(CACHE_OWNER_KEY);
  } catch {
    return null;
  }
}

function writeOwner(userId: string | null) {
  try {
    if (userId === null) localStorage.removeItem(CACHE_OWNER_KEY);
    else localStorage.setItem(CACHE_OWNER_KEY, userId);
  } catch {
    // Storage blocked (private mode) — caches still get cleared on each change
  }
}

/**
 * Deletes the service worker caches that can hold a user's pages, API data and
 * item images, keeping the precache and static build assets. The service
 * worker serves these as offline / slow-network fallbacks, so leaving them
 * behind would show the last user's data to whoever uses the device next.
 */
export async function clearUserCaches(): Promise<boolean> {
  // Cache Storage only exists in secure contexts: nothing to clear
  if (typeof caches === "undefined") return true;
  try {
    const names = await caches.keys();
    await Promise.all(
      names.filter(isUserScopedCache).map((name) => caches.delete(name)),
    );
    return true;
  } catch {
    // Best effort: a failed clear must never break sign-in/out
    return false;
  }
}

// Claims and releases run one at a time, in the order the user changed, so an
// earlier one finishing late can't record a stale owner over the current one
let pending: Promise<void> = Promise.resolve();

function inOrder(task: () => Promise<void>): Promise<void> {
  pending = pending.then(task, task);
  return pending;
}

/**
 * Records `userId` as the owner of the user-scoped caches, clearing them first
 * when they belong to someone else (or to nobody known — caches from before
 * the owner was tracked, or from a sign-out that skipped `releaseUserCaches`).
 */
export function claimUserCaches(userId: string): Promise<void> {
  return inOrder(async () => {
    if (readOwner() === userId) return;
    // Only recorded once cleared, so a failed clear is retried next load
    if (await clearUserCaches()) writeOwner(userId);
  });
}

/** Clears the user-scoped caches on sign-out */
export function releaseUserCaches(): Promise<void> {
  return inOrder(async () => {
    writeOwner(null);
    await clearUserCaches();
  });
}
