"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { clearTrace } from "@/lib/debug/trace";
import { claimUserCaches, releaseUserCaches } from "@/lib/pwa/session-caches";
import { useUserStore } from "@/stores/user-store";

/**
 * Drops user-scoped client state when the signed-in user goes away or changes.
 * Sign-out/sign-in are soft navigations, so the root-level query cache (items,
 * admin data) and the debug trace would otherwise outlive the session and be
 * seen by whoever signs in next in the same tab. Keyed off the user store's
 * `userId`: cleared on sign-out, replaced when a different user hydrates.
 *
 * The service worker's caches outlive the tab too, so they're tied to their
 * owner across page loads (see `claimUserCaches`).
 */
export function SessionStateReset() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // The header hydrates the store in an effect that runs before this one
    const { userId } = useUserStore.getState();
    if (userId !== undefined) void claimUserCaches(userId);

    return useUserStore.subscribe((state, prev) => {
      if (state.userId === prev.userId) return;
      void (state.userId === undefined
        ? releaseUserCaches()
        : claimUserCaches(state.userId));
      if (prev.userId === undefined) return;
      queryClient.clear();
      clearTrace();
    });
  }, [queryClient]);

  return null;
}
