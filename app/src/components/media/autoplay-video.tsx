"use client";

import { useEffect } from "react";
import { useInViewport } from "@/hooks/use-in-viewport";
import { cn } from "@/lib/utils";

type AutoplayVideoProps = {
  src: string;
  posterUrl?: string;
  className?: string;
};

/**
 * Muted, looping video that plays while any part of it is in the viewport
 * and pauses when scrolled away (Twitter-style in-feed autoplay).
 *
 * `preload="none"` means no video bytes are fetched until playback starts,
 * so offscreen items only load their poster image.
 */
export function AutoplayVideo({
  src,
  posterUrl,
  className,
}: AutoplayVideoProps) {
  const { ref, element, isInViewport } = useInViewport<HTMLVideoElement>();

  useEffect(() => {
    if (!element) return;
    if (isInViewport) {
      // Autoplay can be blocked (e.g. Low Power Mode) — poster stays visible
      element.play().catch(() => {});
    } else {
      element.pause();
    }
  }, [element, isInViewport]);

  return (
    <video
      ref={ref}
      src={src}
      poster={posterUrl}
      muted
      loop
      playsInline
      preload="none"
      className={cn("h-full w-full object-cover", className)}
    >
      <track kind="captions" />
    </video>
  );
}
