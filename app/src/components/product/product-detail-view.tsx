"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingEllipsis } from "@/components/ui/loading-ellipsis/loading-ellipsis";
import { getCurrencySymbol } from "@/lib/currency";
import { getProxyImageUrl } from "@/lib/image-url";
import type { ProductDetails, ProductImage } from "@/lib/types/item";
import { cn } from "@/lib/utils";

type ProductDetailViewProps = {
  productDetails: ProductDetails;
  title?: string | null;
  sourceUrl?: string | null;
  coverFileKey?: string | null;
  className?: string;
  onCoverImageChange?: (index: number) => Promise<void>;
};

/**
 * Full product display for the detail dialog.
 * Shows product images (with cover selection), price, brand, and link to original.
 */
export function ProductDetailView({
  productDetails,
  title,
  sourceUrl,
  coverFileKey,
  className,
  onCoverImageChange,
}: ProductDetailViewProps) {
  const {
    brand,
    price,
    currency,
    domain,
    availability,
    images,
    coverImageIndex,
  } = productDetails;

  const productImages = images ?? [];
  const hasImages = productImages.length > 0;

  return (
    <div
      className={cn(
        "flex min-h-full w-full flex-col items-center justify-center bg-background p-6 md:p-8",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-xl space-y-6">
        {/* Product images */}
        {hasImages ? (
          <div
            className={cn(
              "grid gap-2 overflow-hidden rounded-xl",
              productImages.length === 1 && "grid-cols-1",
              productImages.length === 2 && "grid-cols-2",
              productImages.length >= 3 && "grid-cols-2",
            )}
          >
            {productImages.map((img, index) => {
              const isCover = index === (coverImageIndex ?? 0);
              return (
                <ProductImageItem
                  key={img.fileKey}
                  image={img}
                  index={index}
                  isCover={isCover}
                  imageCount={productImages.length}
                  productTitle={title}
                  onCoverImageChange={onCoverImageChange}
                />
              );
            })}
          </div>
        ) : coverFileKey ? (
          <div className="overflow-hidden rounded-xl">
            {/* biome-ignore lint/performance/noImgElement: using proxy URL */}
            <img
              src={getProxyImageUrl(coverFileKey, "full")}
              alt={title ? `${title} product image` : "Product image"}
              className="w-full object-contain"
              loading="lazy"
            />
          </div>
        ) : null}

        {/* Product info */}
        <div className="space-y-2">
          {title && (
            <h2 className="font-semibold text-gray-900 text-xl dark:text-gray-100">
              {title}
            </h2>
          )}
          <div className="flex items-center gap-3">
            {price && (
              <span className="font-bold text-gray-900 text-lg dark:text-gray-100">
                {currency ? `${getCurrencySymbol(currency)}${price}` : price}
              </span>
            )}
            {brand && (
              <span className="text-gray-500 text-sm dark:text-gray-400">
                {brand}
              </span>
            )}
          </div>
          {availability && (
            <p className="text-gray-500 text-sm dark:text-gray-400">
              {formatAvailability(availability)}
            </p>
          )}
        </div>

        {/* View product link */}
        {sourceUrl && (
          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" size="sm" asChild>
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                View on {domain ?? "store"}
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatAvailability(value: string): string {
  switch (value) {
    case "InStock":
      return "In stock";
    case "OutOfStock":
      return "Out of stock";
    case "PreOrder":
      return "Pre-order";
    case "LimitedAvailability":
      return "Limited availability";
    case "Discontinued":
      return "Discontinued";
    default:
      return value;
  }
}

function ProductImageItem({
  image,
  index,
  isCover,
  imageCount,
  productTitle,
  onCoverImageChange,
}: {
  image: ProductImage;
  index: number;
  isCover: boolean;
  imageCount: number;
  productTitle?: string | null;
  onCoverImageChange?: (index: number) => Promise<void>;
}) {
  const [isSettingCover, setIsSettingCover] = useState(false);

  const handleSetCover = async () => {
    if (!onCoverImageChange || isCover || isSettingCover) return;
    setIsSettingCover(true);
    try {
      await onCoverImageChange(index);
    } finally {
      setIsSettingCover(false);
    }
  };

  return (
    <div
      className={cn(
        "group/media relative overflow-hidden bg-gray-100 dark:bg-gray-800",
        imageCount >= 3 && index === 0 && "row-span-2",
      )}
    >
      {/* biome-ignore lint/performance/noImgElement: using proxy URL for stored image */}
      <img
        src={getProxyImageUrl(image.fileKey, "full")}
        alt={
          productTitle
            ? `${productTitle} product image ${index + 1}`
            : `Product image ${index + 1}`
        }
        className="h-full w-full object-cover"
        loading="lazy"
      />
      {onCoverImageChange && imageCount > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSetCover}
          disabled={isCover && !isSettingCover}
          className={cn(
            "absolute top-2 right-2 h-auto px-2 py-1 text-xs transition-opacity",
            "bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 hover:text-white",
            isSettingCover
              ? "opacity-100"
              : isCover
                ? "cursor-default opacity-0 group-hover/media:opacity-70"
                : "opacity-0 group-hover/media:opacity-100",
          )}
        >
          {isSettingCover ? (
            <span>
              Setting as cover
              <LoadingEllipsis />
            </span>
          ) : isCover ? (
            "Cover image"
          ) : (
            "Set as cover"
          )}
        </Button>
      )}
    </div>
  );
}
