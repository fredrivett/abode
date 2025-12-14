"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createLogger } from "@/lib/logger.client";
import {
  applyThemePreference,
  getCurrentPreference,
  getStoredThemePreference,
  storeThemePreference,
  type ThemePreference,
} from "@/lib/theme";

const logger = createLogger("theme-toggle");

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
      logger.error("Failed to persist theme preference", error);
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

  if (!mounted) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost-subtle"
            size="icon"
            className={className}
            aria-label="Toggle theme"
            disabled
          >
            <SunMoon size={18} aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          system
        </TooltipContent>
      </Tooltip>
    );
  }

  const tooltipValue = preference === "auto" ? "system" : preference;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost-subtle"
          size="icon"
          className={className}
          onClick={handleToggle}
          aria-label={`Set ${label}`}
          disabled={isPending}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {tooltipValue}
      </TooltipContent>
    </Tooltip>
  );
}
