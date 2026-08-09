"use client";

import { useEffect } from "react";
import { useExtensionStore } from "@/stores/extension-store";

// Handshake message types, shared with the extension's content script.
export const EXTENSION_PING = "ABODE_EXT_PING";
export const EXTENSION_PONG = "ABODE_EXT_PONG";

/**
 * Detects the abode browser extension and records its presence in the store.
 *
 * The page and the extension's content script share this window's message bus:
 * we post a PING, the content script replies with a PONG carrying its version,
 * and it also announces itself on load — so we catch it regardless of which
 * mounted first. We re-ping on focus, so an extension installed mid-session is
 * picked up without a reload. Renders nothing.
 */
export function ExtensionDetector() {
  const markInstalled = useExtensionStore((s) => s.markInstalled);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Only trust same-window, same-origin messages (the content script posts
      // into this window); ignore anything from iframes or other origins.
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === EXTENSION_PONG) {
        const { version } = event.data;
        markInstalled(typeof version === "string" ? version : null);
      }
    }

    const ping = () =>
      window.postMessage({ type: EXTENSION_PING }, window.location.origin);

    window.addEventListener("message", onMessage);
    window.addEventListener("focus", ping);
    ping();

    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("focus", ping);
    };
  }, [markInstalled]);

  return null;
}
