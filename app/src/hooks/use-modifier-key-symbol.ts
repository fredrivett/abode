"use client";

import { useSyncExternalStore } from "react";
import { getModifierKeySymbol } from "@/lib/keyboard";

/**
 * Symbol rendered during SSR and hydration, before the client platform is
 * known. ⌘ because most desktop usage is on macOS, so most visitors never see
 * the post-hydration swap; it's also the narrower glyph, so the swap only ever
 * widens the key on non-Apple platforms
 */
export const SERVER_MODIFIER_KEY_SYMBOL = "⌘";

// The platform never changes during a session, so there's nothing to subscribe to
const subscribe = () => () => {};

const getServerSnapshot = () => SERVER_MODIFIER_KEY_SYMBOL;

/**
 * The platform modifier key symbol for display (⌘ on Apple, Ctrl elsewhere),
 * safe to render.
 *
 * Calling `getModifierKeySymbol()` during render reads `navigator`, which on
 * the server (Node 21+) reflects the *server's* OS — so a Linux render says
 * "Ctrl", a Mac browser says "⌘", and hydration fails. This returns
 * {@link SERVER_MODIFIER_KEY_SYMBOL} for SSR and hydration, then the real
 * symbol right after; client-only renders (dialogs, menus) get it immediately
 */
export function useModifierKeySymbol(): string {
  return useSyncExternalStore(
    subscribe,
    getModifierKeySymbol,
    getServerSnapshot,
  );
}
