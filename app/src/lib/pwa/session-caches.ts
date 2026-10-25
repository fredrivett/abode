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
export async function clearUserCaches(): Promise<void> {
  // Cache Storage only exists in secure contexts
  if (typeof caches === "undefined") return;
  try {
    const names = await caches.keys();
    await Promise.all(
      names.filter(isUserScopedCache).map((name) => caches.delete(name)),
    );
  } catch {
    // Best effort: a failed clear must never break sign-in/out
  }
}

/**
 * Records `userId` as the owner of the user-scoped caches, clearing them first
 * when they belong to someone else (or to nobody known — caches from before
 * the owner was tracked, or from a sign-out that skipped `releaseUserCaches`).
 */
export async function claimUserCaches(userId: string): Promise<void> {
  if (readOwner() === userId) return;
  await clearUserCaches();
  writeOwner(userId);
}

/** Clears the user-scoped caches on sign-out */
export async function releaseUserCaches(): Promise<void> {
  writeOwner(null);
  await clearUserCaches();
}
