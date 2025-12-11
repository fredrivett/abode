"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  applyThemePreference,
  getCurrentPreference,
  getStoredThemePreference,
  storeThemePreference,
  type ThemePreference,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

const BUTTON_CLASSES =
  "flex items-center text-muted-foreground hover:text-foreground p-1 px-1.5 sm:px-3 sm:py-2 opacity-70 hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer";

const THEME_SEQUENCE: ThemePreference[] = ["auto", "light", "dark"];

function getNextTheme(current: ThemePreference): ThemePreference {
  const index = THEME_SEQUENCE.indexOf(current);
  if (index === -1) return "auto";
  return THEME_SEQUENCE[(index + 1) % THEME_SEQUENCE.length];
}

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false);
  const [preference, setPreference] = useState<ThemePreference>("auto");
  const [isPending, setIsPending] = useState(false);

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

  const handleToggle = useCallback(() => {
    if (!mounted || isPending) return;

    const previous = preference;
    const next = getNextTheme(previous);

    setPreference(next);
    applyThemePreference(next);
    setIsPending(true);

    try {
      storeThemePreference(next);
    } catch (error) {
      setPreference(previous);
      applyThemePreference(previous);
      console.error("Failed to persist theme preference", error);
    } finally {
      setIsPending(false);
    }
  }, [mounted, isPending, preference]);

  const icon = useMemo(() => {
    switch (preference) {
      case "light":
        return <Sun size={18} aria-hidden />;
      case "dark":
        return <Moon size={18} aria-hidden />;
      default:
        return <SunMoon size={18} aria-hidden />;
    }
  }, [preference]);

  const label =
    preference === "auto"
      ? "Auto theme"
      : preference === "light"
        ? "Light theme"
        : "Dark theme";

  const classes = cn(BUTTON_CLASSES, className);

  if (!mounted) {
    return (
      <button
        type="button"
        className={classes}
        aria-label="Toggle theme"
        disabled
      >
        <SunMoon size={18} aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      onClick={handleToggle}
      aria-label={`Set ${label}`}
      title={label}
      disabled={isPending}
    >
      {icon}
    </button>
  );
}
