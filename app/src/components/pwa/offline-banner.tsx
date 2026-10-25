"use client";

import { WifiOff } from "lucide-react";
import posthog from "posthog-js";
import { useEffect } from "react";
import { useIsOnline } from "@/hooks/use-is-online";

/** The notice itself — see {@link OfflineBanner} */
export function OfflineBannerView() {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-muted px-4 py-1.5 text-center text-muted-foreground text-sm"
    >
      <WifiOff className="size-4 shrink-0" />
      <span>
        You're offline, so this is your abode as it was last loaded. Changes
        need a connection.
      </span>
    </div>
  );
}

/**
 * Shown across the signed-in app while there's no connection. The service
 * worker serves the last-loaded copy of a page when offline, so this says why
 * it may be out of date and why saving won't work.
 */
export function OfflineBanner() {
  const isOnline = useIsOnline();

  useEffect(() => {
    // Queued by PostHog and sent once the connection is back
    if (!isOnline) posthog.capture("offline_banner_shown");
  }, [isOnline]);

  return isOnline ? null : <OfflineBannerView />;
}
