"use client";

import { Play } from "lucide-react";
import { VimeoIcon, YouTubeIcon } from "@/components/icons/platform-icons";
import { getProxyImageUrl } from "@/lib/image-url";
import type { VideoDetails } from "@/lib/types/item";
import { cn, formatDuration } from "@/lib/utils";

type VideoCardProps = {
  videoDetails: VideoDetails;
  coverFileKey: string | null;
  onClick: () => void;
  className?: string;
};

/**
 * Grid card for displaying a video preview.
 * Shows thumbnail with play button overlay, duration badge, and platform badge.
 */
export function VideoCard({
  videoDetails,
  coverFileKey,
  onClick,
  className,
}: VideoCardProps) {
  const { platform, channelName, duration } = videoDetails;

  // Use stored thumbnail from Supabase via proxy
  const thumbnailUrl = coverFileKey
    ? getProxyImageUrl(coverFileKey, "grid")
    : null;

  const PlatformBadgeIcon = platform === "youtube" ? YouTubeIcon : VimeoIcon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700",
        className,
      )}
    >
      {/* Thumbnail area */}
      <div className="relative min-h-0 w-full flex-1 overflow-hidden bg-gray-100 dark:bg-gray-800">
        {thumbnailUrl ? (
          <>
            {/* biome-ignore lint/a11y/useAltText: decorative video thumbnail */}
            {/* biome-ignore lint/performance/noImgElement: external video thumbnail URL */}
            <img
              src={thumbnailUrl}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
            {/* Play button overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-full bg-black/60 p-3 transition-transform group-hover:scale-110">
                <Play className="size-6 fill-white text-white" />
              </div>
            </div>
          </>
        ) : (
          // No thumbnail - show platform branding
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
            <PlatformBadgeIcon className="size-12 text-gray-300 dark:text-gray-600" />
          </div>
        )}

        {/* Duration badge (bottom-right) */}
        {duration && duration > 0 && (
          <div className="absolute right-2 bottom-2 rounded bg-black/80 px-1.5 py-0.5 font-medium text-white text-xs">
            {formatDuration(duration)}
          </div>
        )}

        {/* Platform badge (top-right) */}
        <div
          className={cn(
            "absolute top-2 right-2 rounded-full p-1.5 backdrop-blur-sm",
            platform === "youtube" ? "bg-red-600/90" : "bg-[#1ab7ea]/90",
          )}
        >
          <PlatformBadgeIcon className="size-3 text-white" />
        </div>
      </div>

      {/* Channel info (fixed size footer) */}
      {channelName && (
        <div className="shrink-0 p-3">
          <p className="truncate text-left text-gray-700 text-sm dark:text-gray-300">
            {channelName}
          </p>
        </div>
      )}
    </button>
  );
}
