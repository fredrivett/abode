"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { clearTrace } from "@/lib/debug/trace";
import { useUserStore } from "@/stores/user-store";

/**
 * Drops user-scoped client state when the signed-in user goes away or changes.
 * Sign-out/sign-in are soft navigations, so the root-level query cache (items,
 * admin data) and the debug trace would otherwise outlive the session and be
 * seen by whoever signs in next in the same tab. Keyed off the user store's
 * `userId`: cleared on sign-out, replaced when a different user hydrates.
 */
export function SessionStateReset() {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      useUserStore.subscribe((state, prev) => {
        if (prev.userId === undefined || state.userId === prev.userId) return;
        queryClient.clear();
        clearTrace();
      }),
    [queryClient],
  );

  return null;
}
