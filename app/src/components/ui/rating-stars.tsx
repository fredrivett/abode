"use client";

import { Star, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Rating is /10 so half-stars (N*2-1) sit alongside whole stars (N*2).
const STARS = [1, 2, 3, 4, 5];

type RatingStarsProps = {
  rating: number | null;
  onChange: (rating: number | null) => void;
};

/**
 * 5-star rating input with half-star precision. Half-star value (N*2-1 vs
 * N*2) is derived from which half of the star button the pointer is over.
 * Hovering previews the value via local state; leaving the row reverts the
 * display to the persisted rating.
 */
export function RatingStars({ rating, onChange }: RatingStarsProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const isPreviewing = hoverValue != null;
  const displayValue = hoverValue ?? rating ?? 0;

  const valueFromPointer = (
    e: React.MouseEvent<HTMLButtonElement>,
    starIndex: number,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeftHalf = e.clientX - rect.left < rect.width / 2;
    return isLeftHalf ? starIndex * 2 - 1 : starIndex * 2;
  };

  // A keyboard-activated click (Enter/Space) has no real pointer position —
  // browsers report it with detail 0, unlike a genuine mouse click — so it
  // commits the whole-star value the button's label advertises instead of
  // reading a meaningless clientX as "left half".
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>, n: number) => {
    onChange(e.detail === 0 ? n * 2 : valueFromPointer(e, n));
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: reverts hover preview to the committed rating on mouse leave
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHoverValue(null)}
    >
      {STARS.map((n) => {
        const isFull = n * 2 <= displayValue;
        const isHalf = !isFull && n * 2 - 1 === displayValue;
        return (
          <button
            key={n}
            type="button"
            aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
            onMouseMove={(e) => setHoverValue(valueFromPointer(e, n))}
            onClick={(e) => handleClick(e, n)}
            className="relative cursor-pointer p-0.5"
          >
            <Star className="size-4 text-gray-300 dark:text-gray-600" />
            {(isFull || isHalf) && (
              <Star
                className={cn(
                  "absolute top-0.5 left-0.5 size-4 fill-yellow-400 text-yellow-400",
                  isHalf && "[clip-path:inset(0_50%_0_0)]",
                  isPreviewing && "opacity-50",
                )}
              />
            )}
          </button>
        );
      })}
      {rating != null && (
        <button
          type="button"
          aria-label="Clear rating"
          onClick={() => {
            setHoverValue(null);
            onChange(null);
          }}
          className="ml-1 text-gray-400 hover:text-gray-600"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
