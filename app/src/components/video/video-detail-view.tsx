"use client";

import { ExternalLink, Play } from "lucide-react";
import { useState } from "react";
import { VimeoIcon, YouTubeIcon } from "@/components/icons/platform-icons";
import { Button } from "@/components/ui/button";
import { getProxyImageUrl } from "@/lib/image-url";
import type { VideoDetails } from "@/lib/types/item";
import { cn, formatDuration } from "@/lib/utils";

type VideoDetailViewProps = {
  videoDetails: VideoDetails;
  coverFileKey: string | null;
  title: string | null;
  sourceUrl?: string | null;
  className?: string;
};

/**
 * Get the watch URL for a video (for "View on Platform" link)
 */
function getWatchUrl(
  platform: VideoDetails["platform"],
  videoId: string,
): string {
  if (platform === "youtube") {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
  return `https://vimeo.com/${videoId}`;
}

/**
 * Full video display for the detail dialog.
 * Uses facade pattern: shows thumbnail with play button initially,
 * loads iframe only when user clicks to play.
 */
export function VideoDetailView({
  videoDetails,
  coverFileKey,
  title,
  sourceUrl,
  className,
}: VideoDetailViewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const { platform, videoId, channelName, channelUrl, duration, embedUrl } =
    videoDetails;

  // Use stored thumbnail from Supabase via proxy (detail size)
  const thumbnailUrl = coverFileKey
    ? getProxyImageUrl(coverFileKey, "detail")
    : null;

  const watchUrl = sourceUrl ?? getWatchUrl(platform, videoId);
  const PlatformBadgeIcon = platform === "youtube" ? YouTubeIcon : VimeoIcon;
  const platformName = platform === "youtube" ? "YouTube" : "Vimeo";

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center bg-background p-6 md:p-8",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-3xl space-y-4">
        {/* Video player area */}
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
          {isPlaying && embedUrl ? (
            // Iframe player
            <iframe
              src={embedUrl}
              title={title ?? "Video player"}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            // Facade: thumbnail with play button
            <button
              type="button"
              onClick={() => setIsPlaying(true)}
              className="group relative h-full w-full cursor-pointer"
              aria-label="Play video"
            >
              {thumbnailUrl ? (
                // biome-ignore lint/a11y/useAltText: decorative video thumbnail
                // biome-ignore lint/performance/noImgElement: external video thumbnail URL
                <img
                  src={thumbnailUrl}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                  <PlatformBadgeIcon className="size-16 text-gray-600" />
                </div>
              )}

              {/* Large centered play button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-full bg-black/60 p-4 transition-transform group-hover:scale-110 group-hover:bg-black/70">
                  <Play className="size-10 fill-white text-white" />
                </div>
              </div>

              {/* Duration badge (bottom-right) */}
              {duration && duration > 0 && (
                <div className="absolute bottom-3 right-3 rounded bg-black/80 px-2 py-1 text-sm font-medium text-white">
                  {formatDuration(duration)}
                </div>
              )}

              {/* Platform badge (top-right) */}
              <div
                className={cn(
                  "absolute right-3 top-3 rounded-full p-2",
                  platform === "youtube" ? "bg-red-600" : "bg-[#1ab7ea]",
                )}
              >
                <PlatformBadgeIcon className="size-4 text-white" />
              </div>
            </button>
          )}
        </div>

        {/* Video info */}
        <div className="space-y-3">
          {/* Title */}
          {title && (
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h2>
          )}

          {/* Channel info */}
          {channelName && (
            <div className="flex items-center gap-2">
              {channelUrl ? (
                <a
                  href={channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-600 hover:text-gray-900 hover:underline dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {channelName}
                </a>
              ) : (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {channelName}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end pt-2">
          <Button variant="outline" size="sm" asChild>
            <a href={watchUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
              View on {platformName}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
