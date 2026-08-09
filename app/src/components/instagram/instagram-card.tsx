"use client";

import { InstagramIcon } from "@/components/icons/platform-icons";
import { BlurPlaceholder } from "@/components/ui/blur-placeholder";
import { useImageLoaded } from "@/hooks/use-image-loaded";
import { gridCardStyle } from "@/lib/grid-styles";
import { instagramImageSrc } from "@/lib/instagram/image-src";
import { cn } from "@/lib/utils";
import type { InstagramDetails } from "./types";

type InstagramCardProps = {
  instagramDetails: InstagramDetails;
  /** LQIP placeholder for the cover image, shown blurred while it loads. */
  blurDataUrl?: string | null;
  onClick: () => void;
  className?: string;
};

/**
 * Grid card for displaying an Instagram post preview.
 * Shows the post's cover image, falling back to the caption, then an Instagram
 * branding placeholder when neither is present.
 */
export function InstagramCard({
  instagramDetails,
  blurDataUrl,
  onClick,
  className,
}: InstagramCardProps) {
  const { media, caption, authorName, authorUsername } = instagramDetails;

  // Prefer our re-hosted copy, falling back to the original cdninstagram URL.
  const coverIndex = instagramDetails.coverMediaIndex ?? 0;
  const coverMedia = media?.[coverIndex] ?? media?.[0];
  const previewImage = instagramImageSrc(
    coverMedia?.fileKey,
    coverMedia?.url,
    "grid",
  );

  const { loaded: previewLoaded, imgProps } = useImageLoaded(previewImage);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700",
        className,
      )}
      style={gridCardStyle}
    >
      {previewImage ? (
        <div className="relative min-h-0 w-full flex-1 overflow-hidden bg-gray-100 dark:bg-gray-800">
          {/* biome-ignore lint/performance/noImgElement: external Instagram image URL */}
          <img
            {...imgProps}
            src={previewImage}
            alt={`Instagram post by @${authorUsername}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {blurDataUrl && (
            <BlurPlaceholder
              blurDataUrl={blurDataUrl}
              visible={!previewLoaded}
            />
          )}
        </div>
      ) : caption ? (
        // No image - show the caption (with author), clipped with a fade
        <div className="flex min-h-0 w-full flex-1 flex-col gap-2 overflow-hidden p-4 text-left">
          <span className="truncate font-semibold text-gray-800 text-sm dark:text-gray-200">
            {authorName ?? `@${authorUsername}`}
          </span>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <p className="whitespace-pre-wrap text-gray-900 text-sm leading-snug dark:text-gray-100">
              {caption}
            </p>
            {/* Fade out clipped text; invisible over empty card background */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[1.5em] bg-gradient-to-t from-white dark:from-gray-900" />
          </div>
        </div>
      ) : (
        // No image and no caption - centered Instagram branding
        <div className="flex min-h-0 w-full flex-1 items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
          <InstagramIcon className="size-12 text-gray-300 dark:text-gray-600" />
        </div>
      )}

      {/* Instagram badge */}
      <div
        className="absolute rounded-full bg-black/60 backdrop-blur-sm"
        style={{ top: "0.5em", right: "0.5em", padding: "0.375em" }}
      >
        <InstagramIcon className="h-[0.75em] w-[0.75em] text-white" />
      </div>
    </button>
  );
}
