"use client";

import posthog from "posthog-js";
import { useEffect, useRef } from "react";
import { useUserStore } from "@/stores/user-store";

/**
 * Ties the browser's PostHog session to the signed-in user, so their events
 * and session replays land on the same person as server-side events (keyed by
 * user ID) and can be found from the admin users list. Resets on sign-out or
 * account switch so the next user starts a fresh anonymous person. Keyed off
 * the user store's `userId`, like `SessionStateReset`.
 */
export function PostHogIdentity() {
  const userId = useUserStore((state) => state.userId);
  const previousUserId = useRef<string | undefined>(undefined);

  useEffect(() => {
    const previous = previousUserId.current;
    previousUserId.current = userId;
    // PostHog not configured (no key) — nothing to identify
    if (!posthog.__loaded) return;
    if (previous !== undefined && previous !== userId) posthog.reset();
    if (userId !== undefined && posthog.get_distinct_id() !== userId) {
      posthog.identify(userId);
    }
  }, [userId]);

  return null;
}
