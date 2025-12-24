"use client";

import { cn } from "@/lib/utils";

type WidgetType = "badge" | "preview";
type WidgetTheme = "auto" | "light" | "dark";
type WidgetSize = "compact" | "standard";
type ItemCount = 3 | 6 | 9;

type WidgetPreviewProps = {
  room: {
    id: string;
    name: string;
    emoji: string | null;
    itemCount: number;
  };
  username: string;
  config: {
    type: WidgetType;
    theme: WidgetTheme;
    size: WidgetSize;
    items: ItemCount;
  };
};

function getResolvedTheme(theme: WidgetTheme): "light" | "dark" {
  if (theme === "auto") {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return "light";
  }
  return theme;
}

export function WidgetPreview({ room, username, config }: WidgetPreviewProps) {
  const resolvedTheme = getResolvedTheme(config.theme);
  const isCompact = config.size === "compact";
  const isDark = resolvedTheme === "dark";

  // Theme colors
  const colors = {
    bg: isDark ? "#171717" : "#ffffff",
    bgHover: isDark ? "#262626" : "#f5f5f5",
    text: isDark ? "#fafafa" : "#171717",
    textMuted: isDark ? "#a3a3a3" : "#737373",
    border: isDark ? "#404040" : "#e5e5e5",
  };

  const emoji = room.emoji || "\ud83d\udcc1";

  if (config.type === "badge") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full border transition-colors",
          isCompact ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
        )}
        style={{
          backgroundColor: colors.bg,
          borderColor: colors.border,
          color: colors.text,
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <span className={isCompact ? "text-sm" : "text-base"}>{emoji}</span>
        <span className="font-medium">{room.name}</span>
        <span
          className={isCompact ? "text-[10px]" : "text-xs"}
          style={{ color: colors.textMuted }}
        >
          {room.itemCount} items
        </span>
      </div>
    );
  }

  // Preview widget
  const placeholders = Array.from({ length: config.items }, (_, i) => i);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border",
        isCompact ? "max-w-[200px] p-3" : "max-w-[280px] p-4",
      )}
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className={isCompact ? "text-lg" : "text-2xl"}>{emoji}</span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            className={cn(
              "truncate font-semibold",
              isCompact ? "text-sm" : "text-base",
            )}
            style={{ color: colors.text }}
          >
            {room.name}
          </span>
          <span
            className={isCompact ? "text-[10px]" : "text-xs"}
            style={{ color: colors.textMuted }}
          >
            by @{username} &middot; {room.itemCount} items
          </span>
        </div>
      </div>

      {/* Grid */}
      <div
        className="grid grid-cols-3"
        style={{ gap: isCompact ? "0.25rem" : "0.375rem" }}
      >
        {placeholders.map((i) => (
          <div
            key={i}
            className="aspect-square rounded"
            style={{
              backgroundColor: colors.border,
            }}
          />
        ))}
      </div>
    </div>
  );
}
