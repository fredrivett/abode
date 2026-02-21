"use client";

import { useCallback, useEffect, useState } from "react";

import {
  applyThemePreference,
  getCurrentPreference,
  getNextTheme,
  getStoredThemePreference,
  storeThemePreference,
  type ThemePreference,
  type UseThemePreferenceReturn,
} from "@/lib/theme";

/**
 * Manages the user's theme preference (light/dark/auto).
 *
 * On mount, restores the preference from localStorage (or falls back to the
 * DOM/cookie value) and applies it. The returned `toggle` cycles through
 * auto -> light -> dark and persists the choice.
 */
export function useThemePreference(): UseThemePreferenceReturn {
  const [mounted, setMounted] = useState(false);
  const [preference, setPreference] = useState<ThemePreference>("auto");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const stored = getStoredThemePreference();
    const initialPreference = stored ?? getCurrentPreference();

    setPreference(initialPreference);
    applyThemePreference(initialPreference);
  }, [mounted]);

  const toggle = useCallback(() => {
    if (!mounted) return;

    const next = getNextTheme(preference);
    setPreference(next);
    applyThemePreference(next);
    storeThemePreference(next);
  }, [mounted, preference]);

  return { mounted, preference, toggle };
}
