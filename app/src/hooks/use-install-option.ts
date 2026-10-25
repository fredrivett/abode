"use client";

import { useSyncExternalStore } from "react";
import {
  getDisplayMode,
  isIosDevice,
  isTouchPrimary,
} from "@/lib/pwa/display-mode";
import {
  hasInstallPrompt,
  subscribeInstallPrompt,
} from "@/lib/pwa/install-prompt";

/**
 * How abode can be installed here: `"prompt"` when the browser handed us its
 * native install prompt (Android Chrome), `"ios"` when it has to be added
 * by hand from the Share menu, or null (already installed, desktop, or a
 * browser that can't install)
 */
export type InstallOption = "prompt" | "ios" | null;

export function getInstallOption(): InstallOption {
  if (getDisplayMode() === "standalone" || !isTouchPrimary()) return null;
  if (hasInstallPrompt()) return "prompt";
  return isIosDevice() ? "ios" : null;
}

const getServerSnapshot = (): InstallOption => null;

/** {@link getInstallOption}, safe to render: null during SSR and hydration */
export function useInstallOption(): InstallOption {
  return useSyncExternalStore(
    subscribeInstallPrompt,
    getInstallOption,
    getServerSnapshot,
  );
}
