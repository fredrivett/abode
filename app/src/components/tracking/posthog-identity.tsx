"use client";

import posthog from "posthog-js";
import { useEffect, useRef } from "react";
import { setAnalyticsUsername } from "@/lib/analytics/analytics-username";
import { useUserStore } from "@/stores/user-store";

/**
 * Ties the browser's PostHog session to the signed-in user, so their events
 * and session replays land on the same person as server-side events (keyed by
 * user ID) and can be found from the admin users list. Resets on sign-out or
 * account switch so the next user starts a fresh anonymous person. Keyed off
 * the user store's `userId`, like `SessionStateReset`. Also records the
 * username so analytics can mask the user's own (possibly private) room names.
 */
export function PostHogIdentity() {
  const userId = useUserStore((state) => state.userId);
  const username = useUserStore((state) => state.username);
  const previousUserId = useRef<string | undefined>(undefined);

  // Kept while the store is still hydrating on load; cleared on sign-out below
  useEffect(() => {
    if (userId !== undefined && username) setAnalyticsUsername(username);
  }, [userId, username]);

  useEffect(() => {
    const previous = previousUserId.current;
    previousUserId.current = userId;
    if (previous !== undefined && userId === undefined) {
      setAnalyticsUsername(null);
    }
    // PostHog not configured (no key) — nothing to identify
    if (!posthog.__loaded) return;
    const switchedUser = previous !== undefined && previous !== userId;
    const needsIdentify =
      userId !== undefined && posthog.get_distinct_id() !== userId;
    // A persisted identity from someone else (e.g. a shared device where the
    // last user's tab closed without signing out) must not merge into this user
    if (switchedUser || (needsIdentify && posthog._isIdentified())) {
      posthog.reset();
    }
    if (needsIdentify) posthog.identify(userId);
  }, [userId]);

  return null;
}
