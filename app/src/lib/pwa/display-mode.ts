/**
 * Platform checks for the installed-app experience. They read `navigator` /
 * `matchMedia`, so never call them during render (the server has its own
 * `navigator`) — go through `useInstallOption` or an effect.
 */

export type DisplayMode = "standalone" | "browser";

export function getDisplayMode(): DisplayMode {
  if (typeof window === "undefined") return "browser";
  const iosStandalone =
    "standalone" in navigator && navigator.standalone === true;
  return iosStandalone ||
    window.matchMedia("(display-mode: standalone)").matches
    ? "standalone"
    : "browser";
}

/** iPhone / iPad, including iPadOS which reports itself as a Mac */
export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/** Phones and tablets: where a home-screen app is worth suggesting */
export function isTouchPrimary(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}
