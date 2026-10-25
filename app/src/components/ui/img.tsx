"use client";

import type { ComponentProps } from "react";
import { useImageLoaded } from "@/hooks/use-image-loaded";
import { proxyImageSrcSet } from "@/lib/image-url";

type ImgProps = Omit<ComponentProps<"img">, "src" | "srcSet" | "ref"> & {
  src: string | null | undefined;
};

/**
 * A plain `<img>` that retries a failed same-origin load (see
 * {@link useImageLoaded}). Use it for any image served by us — the image proxy,
 * map tiles — so a transient server error doesn't leave it broken until reload.
 * A caller's `onError` runs only once retries are exhausted. Reach for the hook
 * directly when you also need the loaded state (e.g. a blur-up placeholder).
 *
 * Passing `sizes` opts a resized proxy URL into a `srcset` of smaller
 * renditions (see `proxyImageSrcSet`), e.g. `GRID_IMAGE_SIZES` for grid tiles.
 */
export function Img({ src, alt, sizes, onLoad, onError, ...props }: ImgProps) {
  const srcSet = sizes && src ? proxyImageSrcSet(src) : undefined;
  const { imgProps } = useImageLoaded(src, { srcSet });
  return (
    // biome-ignore lint/performance/noImgElement: proxy/blob URLs for user content; next/image can't serve them
    <img
      alt={alt}
      {...props}
      sizes={srcSet ? sizes : undefined}
      {...imgProps}
      onLoad={(event) => {
        imgProps.onLoad();
        onLoad?.(event);
      }}
      onError={(event) => {
        if (!imgProps.onError()) onError?.(event);
      }}
    />
  );
}
