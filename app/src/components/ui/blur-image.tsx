"use client";

import { BlurPlaceholder } from "@/components/ui/blur-placeholder";
import { useImageLoaded } from "@/hooks/use-image-loaded";

type BlurImageProps = {
  /** Full-quality image URL (proxy/blob). Renders nothing when null/undefined. */
  src: string | null | undefined;
  alt: string;
  /** Tiny LQIP data URL; held in place until the real image paints. */
  blurDataUrl: string | null | undefined;
  /** Classes for the `<img>` itself (sizing, object-fit, hover transforms). */
  className?: string;
  loading?: "lazy" | "eager";
};

/**
 * An `<img>` with the blur-up load treatment: a tiny inline LQIP shows the
 * content immediately (no network) and dissolves once the full image paints, so
 * a slow or failed load never leaves an empty tile. Renders a Fragment — the
 * caller owns the wrapper, which must be positioned + `overflow-hidden` for the
 * placeholder's overscan to clip (see {@link BlurPlaceholder}).
 */
export function BlurImage({
  src,
  alt,
  blurDataUrl,
  className,
  loading,
}: BlurImageProps) {
  const { loaded, imgProps } = useImageLoaded(src);
  if (!src) return null;
  return (
    <>
      {/* biome-ignore lint/performance/noImgElement: proxy/blob URL for user-uploaded content */}
      <img
        {...imgProps}
        src={src}
        alt={alt}
        className={className}
        loading={loading}
      />
      {blurDataUrl && (
        <BlurPlaceholder blurDataUrl={blurDataUrl} visible={!loaded} />
      )}
    </>
  );
}
