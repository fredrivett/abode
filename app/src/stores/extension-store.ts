"use client";

import { create } from "zustand";

type ExtensionState = {
  /** True once the browser extension's content script has answered a ping. */
  installed: boolean;
  /** The extension's version, when known. */
  version: string | null;
  markInstalled: (version: string | null) => void;
};

/**
 * Tracks whether the abode browser extension is present in this browser.
 *
 * Populated by <ExtensionDetector> via a window postMessage handshake. Consumers
 * (e.g. the Instagram "Enrich post" action) read `installed` to decide between
 * driving the extension and prompting to install it.
 */
export const useExtensionStore = create<ExtensionState>((set) => ({
  installed: false,
  version: null,
  markInstalled: (version) => set({ installed: true, version }),
}));
