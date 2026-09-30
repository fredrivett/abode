const STORAGE_KEY = "abode:analytics-username";

function readStored(): string | null {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

let current: string | null = readStored();

/**
 * The signed-in user's username, for masking their own room names out of
 * analytics URLs. Persisted so it's known on a hard load before the user
 * store hydrates (the first pageview fires during PostHog init).
 */
export function getAnalyticsUsername(): string | null {
  return current;
}

export function setAnalyticsUsername(username: string | null): void {
  current = username;
  try {
    if (username) globalThis.localStorage?.setItem(STORAGE_KEY, username);
    else globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode) — the in-memory value still applies
  }
}
