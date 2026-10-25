"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  QUEUED_SHARE_HASH,
  REPLAY_SHARE_QUEUE_MESSAGE,
} from "@/lib/pwa/share-queue";
import { ROUTES } from "@/lib/routes";

/**
 * Picks up where the user was. A queued share (see share-queue) is saved by
 * the service worker, not by reloading its own URL (which would save it again),
 * so that nudges the queue and moves on to the dashboard.
 */
function resume(shareQueued: boolean) {
  if (!shareQueued) return window.location.reload();
  // Still offline: stay, so the "saved for later" note stays put
  if (!navigator.onLine) return;
  navigator.serviceWorker?.controller?.postMessage(REPLAY_SHARE_QUEUE_MESSAGE);
  window.location.replace(ROUTES.DASHBOARD);
}

export default function OfflinePage() {
  const [shareQueued, setShareQueued] = useState(false);

  useEffect(() => {
    const queued = window.location.hash === QUEUED_SHARE_HASH;
    setShareQueued(queued);
    const onOnline = () => resume(queued);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center">
        <h1 className="mb-4 font-semibold text-2xl">You're offline</h1>
        <p className="mb-6 text-muted-foreground">
          {shareQueued
            ? "Your link is saved for later. It'll be added to your abode once you're back online."
            : "This page will reload once you're back online."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => resume(shareQueued)}>Try again</Button>
          {/* The service worker keeps the last-loaded dashboard for offline use;
              when it has none this page simply comes back */}
          <Button variant="outline" asChild>
            <a href={ROUTES.DASHBOARD}>Open your saved abode</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
