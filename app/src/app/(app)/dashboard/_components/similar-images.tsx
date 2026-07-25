"use client";

import Link from "next/link";
import posthog from "posthog-js";
import { useEffect, useRef } from "react";
import { getProxyImageUrl } from "@/lib/image-url";
import { useSimilarImages } from "@/lib/search/use-similar-images";
import { useUserStore } from "@/stores/user-store";

type SimilarImagesProps = {
  itemId: string;
  /** Only fetch/show when the detail view is open and the item is an image. */
  enabled: boolean;
  /** Called when a similar image is clicked (e.g. to close the current dialog). */
  onNavigate?: () => void;
};

/**
 * "Similar images" section for the item detail sidebar. Owner-scoped visual
 * discovery: shows the closest-matching photos from the user's own library.
 *
 * Renders nothing until there's at least one match above the similarity
 * threshold — the section simply doesn't appear when there's nothing alike
 * (or when the item has no visual embedding).
 */
export function SimilarImages({
  itemId,
  enabled,
  onNavigate,
}: SimilarImagesProps) {
  const username = useUserStore((state) => state.username);
  const { data } = useSimilarImages(itemId, enabled);
  const items = data?.items ?? [];

  // Fire a single "viewed" event the first time results appear for this item.
  const trackedRef = useRef(false);
  useEffect(() => {
    if (items.length > 0 && !trackedRef.current) {
      trackedRef.current = true;
      posthog.capture("similar_images_viewed", {
        item_id: itemId,
        result_count: items.length,
      });
    }
  }, [items.length, itemId]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-gray-700 text-sm dark:text-gray-300">
        Similar images
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => {
          const href = username
            ? `/@${username}/items/${item.id}`
            : `/items/${item.id}`;
          return (
            <Link
              key={item.id}
              href={href}
              onClick={() => {
                posthog.capture("similar_image_clicked", {
                  item_id: itemId,
                  target_item_id: item.id,
                });
                onNavigate?.();
              }}
              className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted"
            >
              {item.fileKey && (
                // biome-ignore lint/performance/noImgElement: proxy URL for user-uploaded content
                <img
                  src={getProxyImageUrl(item.fileKey, "grid")}
                  alt={item.title ?? "Similar image"}
                  className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
