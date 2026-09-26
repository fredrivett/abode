import { useSyncExternalStore } from "react";

/**
 * Per-browser opt-in for the admin debug tools, persisted in localStorage so it
 * survives reloads (jank is often only visible on a cold load). Toggle from the
 * account menu, or via `?debug=1` / `?debug=0` on any page.
 */
export const DEBUG_STORAGE_KEY = "abode:debug";
export const DEBUG_URL_PARAM = "debug";

const listeners = new Set<() => void>();

function readStored(): boolean {
  try {
    return window.localStorage.getItem(DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isDebugFlagOn(): boolean {
  return typeof window !== "undefined" && readStored();
}

export function setDebugFlag(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(DEBUG_STORAGE_KEY, "1");
    else window.localStorage.removeItem(DEBUG_STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode quota etc.) — the toggle just won't persist
  }
  for (const listener of listeners) listener();
}

/** `?debug=1` → true, `?debug=0` → false, absent/other → null (leave as is). */
export function parseDebugParam(search: string): boolean | null {
  const value = new URLSearchParams(search).get(DEBUG_URL_PARAM);
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return null;
}

/** Apply a `?debug=` param from the current URL, if present. */
export function applyDebugParam(): void {
  const next = parseDebugParam(window.location.search);
  if (next !== null && next !== readStored()) setDebugFlag(next);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Keep tabs in sync when toggled elsewhere
  const onStorage = (event: StorageEvent) => {
    if (event.key === DEBUG_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Reactive debug flag; always false during SSR/hydration. */
export function useDebugFlag(): boolean {
  return useSyncExternalStore(subscribe, readStored, () => false);
}
