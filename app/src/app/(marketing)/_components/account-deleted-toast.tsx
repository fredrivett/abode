"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { releaseUserCaches } from "@/lib/pwa/session-caches";
import { useUserStore } from "@/stores/user-store";

/**
 * Where account deletion lands. The delete action signs out and redirects
 * itself, skipping `SignOutForm`, so this drops the deleted user's client
 * state and clears the device's caches and offline library. Cleared here
 * directly as well: after a full page load nobody was hydrated, so
 * `SessionStateReset` sees no sign-out to react to.
 */
export function AccountDeletedToast() {
  const searchParams = useSearchParams();
  const showToast = searchParams.get("account-deleted") === "true";
  const hasShownToast = useRef(false);

  useEffect(() => {
    if (showToast && !hasShownToast.current) {
      hasShownToast.current = true;
      useUserStore.getState().clearUser();
      void releaseUserCaches();
      toast.success("Your account has been permanently deleted", {
        duration: Number.POSITIVE_INFINITY,
      });
    }
  }, [showToast]);

  return null;
}
