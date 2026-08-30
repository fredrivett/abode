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

/**
 * Shortcut definition for matchesShortcut.
 */
export type Shortcut = {
  /** The key to match (case-insensitive, e.g., "k", "Enter", "Escape") */
  key: string;
  /** Whether the platform modifier (Cmd on Mac, Ctrl on others) must be pressed */
  modifier?: boolean;
  /** Whether the Shift key must be pressed */
  shift?: boolean;
  /** Whether the Alt/Option key must be pressed */
  alt?: boolean;
};

/**
 * Checks if a keyboard event matches a shortcut definition.
 *
 * This provides a reliable, cross-platform way to check keyboard shortcuts:
 * - Key comparison is case-insensitive (handles Shift changing "k" to "K")
 * - Uses platform-appropriate modifier key (Cmd on Mac, Ctrl on others)
 *
 * @example
 * // Cmd/Ctrl+K
 * if (matchesShortcut(e, { key: 'k', modifier: true })) { ... }
 *
 * // Cmd/Ctrl+Shift+K
 * if (matchesShortcut(e, { key: 'k', modifier: true, shift: true })) { ... }
 *
 * // Just Enter key
 * if (matchesShortcut(e, { key: 'Enter' })) { ... }
 */
export function matchesShortcut(
  event: KeyboardEvent | React.KeyboardEvent,
  shortcut: Shortcut,
): boolean {
  // Guard against undefined key (can happen with IME events or certain browser edge cases)
  if (!event.key) {
    return false;
  }

  // Case-insensitive key comparison (Shift changes "k" to "K")
  if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) {
    return false;
  }

  // Check platform modifier (Cmd on Mac, Ctrl on others)
  if (shortcut.modifier !== undefined) {
    if (shortcut.modifier !== getModifierKey(event)) {
      return false;
    }
  }

  // Check shift key
  if (shortcut.shift !== undefined) {
    if (shortcut.shift !== event.shiftKey) {
      return false;
    }
  }

  // Check alt/option key
  if (shortcut.alt !== undefined) {
    if (shortcut.alt !== event.altKey) {
      return false;
    }
  }

  return true;
}

/**
 * Whether an event target (or focused element) is an editable field the user
 * might be typing in — an input, textarea, select, or contenteditable element.
 *
 * Use it to skip global key/paste handlers so they don't fire mid-edit.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}
