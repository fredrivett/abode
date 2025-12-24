"use client";

import { BalancedMasonryGrid, Frame } from "@masonry-grid/react";
import Image from "next/image";
import { AbodeLogo } from "@/components/abode-logo";
import type { Filter } from "@/lib/search/types";
import { FILTER_TYPES } from "@/lib/search/types";
import { cn } from "@/lib/utils";

type WidgetType = "badge" | "preview";
type WidgetTheme = "auto" | "light" | "dark";
type WidgetSize = "compact" | "standard";
type ItemCount = 3 | 6 | 9;

type RoomItem = {
  id: string;
  kind: string | null;
  title: string | null;
  fileKey: string | null;
  coverFileKey: string | null;
  meta: Record<string, unknown> | null;
};

type WidgetPreviewProps = {
  room: {
    id: string;
    name: string;
    emoji: string | null;
    itemCount: number;
    filters?: Filter[] | null;
  };
  username: string;
  config: {
    type: WidgetType;
    theme: WidgetTheme;
    size: WidgetSize;
    items: ItemCount;
    showFilters: boolean;
  };
  roomItems?: RoomItem[];
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

export function WidgetPreview({
  room,
  username,
  config,
  roomItems = [],
}: WidgetPreviewProps) {
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

  const emoji = room.emoji;

  if (config.type === "badge") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full border transition-colors",
          isCompact ? "px-3 py-1.5" : "px-4 py-2",
        )}
        style={{
          backgroundColor: colors.bg,
          borderColor: colors.border,
          color: colors.text,
        }}
      >
        {emoji && (
          <span className={isCompact ? "text-base" : "text-lg"}>{emoji}</span>
        )}
        <span
          className={cn("font-medium", isCompact ? "text-sm" : "text-base")}
          style={{
            fontFamily:
              "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif",
          }}
        >
          {room.name}
        </span>
      </div>
    );
  }

  // Preview widget - get the items to display
  const itemsToShow = roomItems.slice(0, config.items);

  // Build image URL for an item
  const getImageUrl = (item: RoomItem) => {
    const isArticle = item.kind === "article";
    const fileKey = isArticle ? item.coverFileKey : item.fileKey;
    if (!fileKey) return null;
    return `/api/v1/images/${encodeURIComponent(fileKey)}`;
  };

  // Get aspect ratio for an item
  const getAspectRatio = (item: RoomItem) => {
    const isArticle = item.kind === "article";
    if (isArticle) {
      return { width: 16, height: 9 };
    }
    const meta = item.meta || {};
    return {
      width: (meta.width as number) ?? 1,
      height: (meta.height as number) ?? 1,
    };
  };

  // Build URLs
  const roomUrl = `/@${username}/${room.id}`;
  const profileUrl = `/@${username}`;

  // Frame width for masonry - smaller means more columns
  const frameWidth = isCompact ? 80 : 120;
  const gap = isCompact ? 4 : 8;

  // Format filter value for display
  const formatFilterValue = (filter: Filter) => {
    const meta = FILTER_TYPES[filter.type];
    const prefix = filter.negated ? "NOT " : "";

    // Handle date filters with operators
    if (filter.type === "date") {
      switch (filter.dateOperator) {
        case "after":
          return `${meta.icon} ${prefix}>${filter.value}`;
        case "before":
          return `${meta.icon} ${prefix}<${filter.value}`;
        case "between":
          return `${meta.icon} ${prefix}${filter.value}..${filter.endDate}`;
        default:
          return `${meta.icon} ${prefix}${filter.value}`;
      }
    }

    return `${meta.icon} ${prefix}${filter.value}`;
  };

  const filters = room.filters ?? [];
  const showFilters = config.showFilters && filters.length > 0;

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3 rounded-xl border",
        isCompact ? "max-w-sm p-3" : "p-4",
      )}
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        {/* Left: Room Info */}
        <div className="flex shrink-0 flex-1 gap-3">
          {emoji && (
            <span
              className={cn("leading-none", isCompact ? "text-lg" : "text-2xl")}
            >
              {emoji}
            </span>
          )}
          <div className="flex flex-col">
            <a
              href={roomUrl}
              className={cn(
                "self-start font-semibold whitespace-nowrap hover:underline mb-0.5",
                isCompact ? "text-sm" : "text-base",
              )}
              style={{ color: colors.text, textDecoration: "none" }}
            >
              {room.name}
            </a>
            <span
              className={isCompact ? "text-[10px]" : "text-xs"}
              style={{ color: colors.textMuted }}
            >
              by{" "}
              <a
                href={profileUrl}
                className="hover:underline"
                style={{ color: colors.textMuted }}
                onClick={(e) => e.stopPropagation()}
              >
                @{username}
              </a>{" "}
              &middot; {room.itemCount} items
            </span>
            {showFilters && (
              <div className={cn("flex flex-wrap justify-end gap-1 mt-2")}>
                {filters.map((filter) => (
                  <span
                    key={filter.id}
                    className={cn(
                      "inline-flex items-center rounded-full border cursor-default px-1.5 py-0.5",
                      isCompact ? "text-[8px]" : "text-[10px]",
                    )}
                    style={{
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.05)",
                      borderColor: colors.border,
                      color: colors.textMuted,
                    }}
                  >
                    {formatFilterValue(filter)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Logo and Filters */}
        <div className="flex flex-col shrink-1 items-end gap-2">
          <a
            href="https://www.abode.fyi"
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-50 transition-opacity hover:opacity-100 p-2 -m-2"
            aria-label="Powered by Abode"
          >
            <AbodeLogo
              className={isCompact ? "h-2.5 w-auto" : "h-3 w-auto"}
              style={{ color: colors.textMuted }}
            />
          </a>
        </div>
      </div>

      {/* Masonry Grid - links to room */}
      {itemsToShow.length > 0 && (
        <a href={roomUrl} className="block">
          <BalancedMasonryGrid
            frameWidth={frameWidth}
            gap={gap}
            style={{ overflow: "visible" }}
          >
            {itemsToShow.map((item) => {
              const imageUrl = getImageUrl(item);
              const { width, height } = getAspectRatio(item);
              return (
                <Frame key={item.id} width={width} height={height}>
                  <div
                    className="relative h-full w-full overflow-hidden rounded"
                    style={{ backgroundColor: colors.border }}
                  >
                    {imageUrl && (
                      <Image
                        src={imageUrl}
                        alt={item.title || ""}
                        fill
                        className="object-cover"
                        sizes="200px"
                      />
                    )}
                  </div>
                </Frame>
              );
            })}
          </BalancedMasonryGrid>
        </a>
      )}
    </div>
  );
}
