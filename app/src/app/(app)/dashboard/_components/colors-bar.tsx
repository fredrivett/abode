"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { copyToClipboard } from "@/lib/copy";
import type { ImageColor } from "@/lib/types/item";

const MIN_WIDTH_PERCENT = 3;

/**
 * Calculate width percentages for colors with minimum width enforcement.
 * Small colors are bumped to the minimum, and larger colors are scaled down
 * proportionally so the total always equals 100%.
 */
export function calculateWidths(colors: ImageColor[]): number[] {
  if (colors.length === 0) return [];

  const totalScore =
    colors.reduce((sum, color) => sum + (color.score ?? 0), 0) || 1;

  // Calculate base widths as percentages
  const baseWidths = colors.map(
    (color) => ((color.score ?? 0) / totalScore) * 100,
  );

  // Find which colors are below minimum
  const smallIndexes: number[] = [];
  const largeIndexes: number[] = [];
  for (let i = 0; i < baseWidths.length; i++) {
    if (baseWidths[i] < MIN_WIDTH_PERCENT) {
      smallIndexes.push(i);
    } else {
      largeIndexes.push(i);
    }
  }

  // If none are below minimum, return base widths
  if (smallIndexes.length === 0) return baseWidths;

  // If all colors are below minimum, distribute evenly
  if (largeIndexes.length === 0) {
    return colors.map(() => 100 / colors.length);
  }

  // Calculate remaining space after giving small colors the minimum
  const spaceForSmall = smallIndexes.length * MIN_WIDTH_PERCENT;
  const spaceForLarge = 100 - spaceForSmall;

  // If not enough space for large colors, distribute evenly
  if (spaceForLarge <= 0) {
    return colors.map(() => 100 / colors.length);
  }

  // Scale large colors to fit remaining space
  const largeTotal = largeIndexes.reduce((sum, i) => sum + baseWidths[i], 0);
  const scale = spaceForLarge / largeTotal;

  return baseWidths.map((width, i) =>
    smallIndexes.includes(i) ? MIN_WIDTH_PERCENT : width * scale,
  );
}

type ColorsBarProps = {
  colors: ImageColor[];
  onColorHover?: (hex: string) => void;
  onColorHoverEnd?: () => void;
};

const LONG_PRESS_DURATION = 500;

export function ColorsBar({
  colors,
  onColorHover,
  onColorHoverEnd,
}: ColorsBarProps) {
  const [activeHex, setActiveHex] = useState<string | null>(null);
  const [pinnedHex, setPinnedHex] = useState<string | null>(null);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [longPressHex, setLongPressHex] = useState<string | null>(null);
  const copiedTimeoutRef = useRef<number | null>(null);
  const longPressTimeoutRef = useRef<number | null>(null);

  const widths = useMemo(() => calculateWidths(colors), [colors]);

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current)
        window.clearTimeout(copiedTimeoutRef.current);
      if (longPressTimeoutRef.current)
        window.clearTimeout(longPressTimeoutRef.current);
    };
  }, []);

  if (colors.length === 0) return null;

  const copyColor = async (hex: string) => {
    setPinnedHex(hex);
    if (!(await copyToClipboard(hex))) {
      setPinnedHex((prev) => (prev === hex ? null : prev));
      return;
    }

    setCopiedHex(hex);
    if (copiedTimeoutRef.current) window.clearTimeout(copiedTimeoutRef.current);
    copiedTimeoutRef.current = window.setTimeout(() => {
      setCopiedHex((prev) => (prev === hex ? null : prev));
      setPinnedHex((prev) => (prev === hex ? null : prev));
    }, 1200);
  };

  return (
    <fieldset
      aria-label="Colors"
      className="m-0 flex h-4 w-full min-w-0 overflow-hidden p-0 transition-[height] duration-200 ease-out hover:h-8"
    >
      {colors.map((color, index) => {
        const widthPercent = widths[index];
        const percent = Math.round(widthPercent);
        const isOpen =
          pinnedHex === color.hex ||
          copiedHex === color.hex ||
          (!pinnedHex && activeHex === color.hex);
        const isCopied = copiedHex === color.hex;

        return (
          <Tooltip
            key={`${color.hex}-${index}`}
            open={isOpen}
            disableHoverableContent
          >
            <TooltipTrigger asChild>
              <button
                type="button"
                className={`h-full shrink-0 appearance-none border-0 bg-transparent p-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${isCopied ? "cursor-copy-check" : "cursor-pipette"}`}
                style={{
                  backgroundColor: color.hex,
                  width: `${widthPercent}%`,
                }}
                aria-label={`Copy ${color.hex} (${percent}%)`}
                onMouseEnter={() => {
                  setActiveHex(color.hex);
                  onColorHover?.(color.hex);
                }}
                onMouseLeave={() => {
                  setActiveHex((prev) => (prev === color.hex ? null : prev));
                  onColorHoverEnd?.();
                }}
                onFocus={() => {
                  setActiveHex(color.hex);
                  onColorHover?.(color.hex);
                }}
                onBlur={() => {
                  setActiveHex((prev) => (prev === color.hex ? null : prev));
                  onColorHoverEnd?.();
                }}
                onClick={() => {
                  void copyColor(color.hex);
                }}
                onTouchStart={() => {
                  if (longPressTimeoutRef.current)
                    window.clearTimeout(longPressTimeoutRef.current);
                  longPressTimeoutRef.current = window.setTimeout(() => {
                    setLongPressHex(color.hex);
                    onColorHover?.(color.hex);
                  }, LONG_PRESS_DURATION);
                }}
                onTouchMove={() => {
                  if (longPressTimeoutRef.current) {
                    window.clearTimeout(longPressTimeoutRef.current);
                    longPressTimeoutRef.current = null;
                  }
                }}
                onTouchEnd={() => {
                  if (longPressTimeoutRef.current)
                    window.clearTimeout(longPressTimeoutRef.current);
                  if (longPressHex) {
                    setLongPressHex(null);
                    onColorHoverEnd?.();
                  }
                }}
                onTouchCancel={() => {
                  if (longPressTimeoutRef.current)
                    window.clearTimeout(longPressTimeoutRef.current);
                  if (longPressHex) {
                    setLongPressHex(null);
                    onColorHoverEnd?.();
                  }
                }}
                onContextMenu={(e) => {
                  if (longPressHex) e.preventDefault();
                }}
              />
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>
              {isCopied ? (
                <span className="font-mono">Copied!</span>
              ) : (
                <div className="flex items-center gap-2">
                  <div
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-sm border border-gray-200/60 dark:border-gray-700"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="font-mono">{color.hex}</span>
                  <span className="text-gray-500">· {percent}%</span>
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </fieldset>
  );
}
