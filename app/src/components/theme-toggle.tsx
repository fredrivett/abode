"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useThemePreference } from "@/lib/use-theme-preference";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { mounted, preference, toggle } = useThemePreference();

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
          onClick={toggle}
          aria-label={`Set ${label}`}
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
