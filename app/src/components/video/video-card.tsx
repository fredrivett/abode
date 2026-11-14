"use client";

import { VimeoIcon, YouTubeIcon } from "@/components/icons/platform-icons";
import { useGridImageSizes } from "@/components/masonry/masonry-cell-width";
import {
  CardCornerBadge,
  CardPlayIndicator,
  CardTag,
} from "@/components/ui/card-overlay";
import { Img } from "@/components/ui/img";
import { gridCardStyle } from "@/lib/grid-styles";
import { getProxyImageUrl } from "@/lib/image-url";
import type { VideoDetails } from "@/lib/types/item";
import { cn, formatDuration } from "@/lib/utils";

type VideoCardProps = {
  videoDetails: VideoDetails;
  coverFileKey: string | null;
  title?: string | null;
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
  title,
  onClick,
  className,
}: VideoCardProps) {
  const { platform, duration } = videoDetails;
  const gridImageSizes = useGridImageSizes();

  // Prefer the downloaded cover (proxied); fall back to the platform's external
  // thumbnail when there's no local cover yet (e.g. seed data, or before
  // enrichment downloads it).
  const thumbnailUrl = coverFileKey
    ? getProxyImageUrl(coverFileKey, "grid")
    : videoDetails.thumbnailUrl;

  const PlatformBadgeIcon = platform === "youtube" ? YouTubeIcon : VimeoIcon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700",
        className,
      )}
      style={gridCardStyle}
    >
      {/* Thumbnail area - 16:9 aspect ratio */}
      <div className="relative aspect-video w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
        {thumbnailUrl ? (
          <>
            <Img
              src={thumbnailUrl}
              alt={title ?? "Video thumbnail"}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
              sizes={gridImageSizes}
            />
            <CardPlayIndicator />
          </>
        ) : (
          // No thumbnail - show platform branding
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
            <PlatformBadgeIcon className="h-[3em] w-[3em] text-gray-300 dark:text-gray-600" />
          </div>
        )}

        {duration && duration > 0 && (
          <CardTag corner="bottom-right">{formatDuration(duration)}</CardTag>
        )}

        <CardCornerBadge icon={<PlatformBadgeIcon />} />
      </div>
    </button>
  );
}
