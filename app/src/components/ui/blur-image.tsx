"use client";

import { BlurPlaceholder } from "@/components/ui/blur-placeholder";
import { useImageLoaded } from "@/hooks/use-image-loaded";
import { proxyImageSrcSet } from "@/lib/image-url";

type BlurImageProps = {
  /** Full-quality image URL (proxy/blob). Renders nothing when null/undefined. */
  src: string | null | undefined;
  alt: string;
  /** Tiny LQIP data URL; held in place until the real image paints. */
  blurDataUrl: string | null | undefined;
  /** Classes for the `<img>` itself (sizing, object-fit, hover transforms). */
  className?: string;
  loading?: "lazy" | "eager";
  /** Opts a resized proxy URL into a `srcset` of smaller renditions (see `Img`) */
  sizes?: string;
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
  sizes,
}: BlurImageProps) {
  const srcSet = sizes && src ? proxyImageSrcSet(src) : undefined;
  const { loaded, imgProps } = useImageLoaded(src, { srcSet });
  if (!src) return null;
  return (
    <>
      {/* biome-ignore lint/performance/noImgElement: proxy/blob URL for user-uploaded content */}
      <img
        {...imgProps}
        alt={alt}
        className={className}
        loading={loading}
        sizes={srcSet ? sizes : undefined}
      />
      {blurDataUrl && (
        <BlurPlaceholder blurDataUrl={blurDataUrl} visible={!loaded} />
      )}
    </>
  );
}
