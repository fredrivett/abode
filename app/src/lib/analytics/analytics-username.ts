/** Mask every room slug: someone is signed in but we don't yet know who */
export const ANY_ROOM_OWNER = Symbol("any room owner");

/** Whose room slugs to mask in analytics URLs; null masks none */
export type RoomMaskScope = string | typeof ANY_ROOM_OWNER | null;

// undefined until the user store confirms who (if anyone) is signed in
let confirmedUsername: string | null | undefined;

// Supabase's browser client keeps its session in a JS-readable cookie
const AUTH_COOKIE = /(?:^|;\s*)sb-[^=;]*-auth-token(?:\.\d+)?=/;

function hasAuthCookie(): boolean {
  try {
    return AUTH_COOKIE.test(globalThis.document?.cookie ?? "");
  } catch {
    return false;
  }
}

/**
 * Whose room names to mask. Once the user store has confirmed the signed-in
 * user, only their own rooms (the only way to reach a private room). Before
 * that — e.g. the first pageview during PostHog init on a hard load — every
 * room if a session cookie exists, since the viewer could be any owner; and
 * none when signed out, so visitors' public-room paths are kept.
 */
export function getRoomMaskScope(): RoomMaskScope {
  if (confirmedUsername !== undefined) return confirmedUsername;
  return hasAuthCookie() ? ANY_ROOM_OWNER : null;
}

/** Record the confirmed signed-in user's username (null when signed out) */
export function setAnalyticsUsername(username: string | null): void {
  confirmedUsername = username;
}

/** Back to "not yet confirmed" — for tests */
export function resetAnalyticsUsername(): void {
  confirmedUsername = undefined;
}
