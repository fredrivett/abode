/**
 * Keyboard utilities for platform-specific shortcuts.
 *
 * Uses a hybrid detection approach for maximum compatibility:
 * 1. navigator.userAgentData.platform (modern, Chromium-only)
 * 2. navigator.platform (deprecated but widely supported)
 * 3. navigator.userAgent (fallback)
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/NavigatorUAData/platform
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/platform
 */

// Extend Navigator type to include userAgentData (not in all TS libs)
declare global {
  interface Navigator {
    userAgentData?: {
      platform: string;
      mobile: boolean;
      brands: Array<{ brand: string; version: string }>;
    };
  }
}

/**
 * Detects if the user is on an Apple platform (macOS, iOS, iPadOS).
 *
 * This is primarily used for determining the correct modifier key:
 * - Apple: ⌘ Command (metaKey)
 * - Others: Ctrl (ctrlKey)
 *
 * Detection priority:
 * 1. userAgentData.platform === 'macOS' (Chrome 90+, Edge 90+, Opera 76+)
 * 2. navigator.platform starts with 'Mac' or is 'iPhone'/'iPad'
 * 3. navigator.userAgent contains 'Mac' (final fallback)
 */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  // Modern API (Chromium browsers only - Chrome, Edge, Opera)
  // Returns "macOS" for Mac, "iOS" for iPhone/iPad
  if (navigator.userAgentData?.platform) {
    const platform = navigator.userAgentData.platform;
    return platform === "macOS" || platform === "iOS";
  }

  // Deprecated but widely supported (Safari, Firefox, older browsers)
  // Returns "MacIntel", "MacPPC", "iPhone", "iPad", etc.
  const platform = navigator.platform;
  if (platform) {
    return (
      platform.startsWith("Mac") || platform === "iPhone" || platform === "iPad"
    );
  }

  // Final fallback - userAgent string
  return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Returns the appropriate modifier key for the current platform.
 * - Apple: metaKey (⌘ Command)
 * - Others: ctrlKey (Ctrl)
 */
export function getModifierKey(
  event: KeyboardEvent | React.KeyboardEvent,
): boolean {
  return isApplePlatform() ? event.metaKey : event.ctrlKey;
}

/**
 * Returns the modifier key symbol for display.
 * - Apple: ⌘
 * - Others: Ctrl
 */
export function getModifierKeySymbol(): string {
  return isApplePlatform() ? "⌘" : "Ctrl";
}
