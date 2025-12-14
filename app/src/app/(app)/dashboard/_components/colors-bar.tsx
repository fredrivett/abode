"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { copyToClipboard } from "@/lib/copy";
import type { ImageColor } from "@/lib/vision";

type ColorsBarProps = {
  colors: ImageColor[];
  minSlicePx?: number;
};

function getAdjustedSliceWidthsPx({
  colors,
  containerWidthPx,
  minSlicePx,
}: {
  colors: ImageColor[];
  containerWidthPx: number;
  minSlicePx: number;
}) {
  if (!Number.isFinite(containerWidthPx) || containerWidthPx <= 0) return null;
  if (colors.length === 0) return null;

  const totalScore =
    colors.reduce((sum, color) => sum + (color.score ?? 0), 0) || 1;

  const clampedMinSlicePx = Math.max(
    1,
    Math.min(minSlicePx, containerWidthPx / colors.length),
  );

  const baseWidthsPx = colors.map(
    (color) => (Math.max(color.score ?? 0, 0) / totalScore) * containerWidthPx,
  );

  const smallIndexes: number[] = [];
  const largeIndexes: number[] = [];
  for (let i = 0; i < baseWidthsPx.length; i += 1) {
    if (baseWidthsPx[i] < clampedMinSlicePx) smallIndexes.push(i);
    else largeIndexes.push(i);
  }

  if (smallIndexes.length === 0) return baseWidthsPx;

  const remainingWidthPx =
    containerWidthPx - smallIndexes.length * clampedMinSlicePx;
  if (remainingWidthPx <= 0) {
    const even = containerWidthPx / colors.length;
    return colors.map(() => even);
  }

  const largeBaseSumPx = largeIndexes.reduce(
    (sum, index) => sum + baseWidthsPx[index],
    0,
  );
  const scale = largeBaseSumPx > 0 ? remainingWidthPx / largeBaseSumPx : 0;

  return baseWidthsPx.map((widthPx) =>
    widthPx < clampedMinSlicePx ? clampedMinSlicePx : widthPx * scale,
  );
}

export function ColorsBar({ colors, minSlicePx = 12 }: ColorsBarProps) {
  const containerRef = useRef<HTMLFieldSetElement>(null);
  const [containerWidthPx, setContainerWidthPx] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [activeHex, setActiveHex] = useState<string | null>(null);
  const [pinnedHex, setPinnedHex] = useState<string | null>(null);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const copiedTimeoutRef = useRef<number | null>(null);

  const totalScore = useMemo(
    () => colors.reduce((sum, color) => sum + (color.score ?? 0), 0) || 1,
    [colors],
  );

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current)
        window.clearTimeout(copiedTimeoutRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const nextWidth = el.getBoundingClientRect().width;
      setContainerWidthPx(nextWidth);
    };

    update();

    const observer = new ResizeObserver(() => {
      update();
    });

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  const sliceWidthsPx = useMemo(() => {
    if (!containerWidthPx) return null;

    return getAdjustedSliceWidthsPx({
      colors,
      containerWidthPx,
      minSlicePx: isHovered ? minSlicePx : 4,
    });
  }, [colors, containerWidthPx, isHovered, minSlicePx]);

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
      ref={containerRef}
      aria-label="Colors"
      className="m-0 flex h-4 min-w-0 overflow-hidden rounded-md border border-zinc-200 p-0 hover:h-8 dark:border-zinc-700 transition-[height] duration-200 ease-out"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {colors.map((color, index) => {
        const percent = Math.round(((color.score ?? 0) / totalScore) * 100);
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
                className="h-full cursor-pipette appearance-none border-0 bg-transparent p-0 transition-[width] duration-200 ease-out outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                style={
                  sliceWidthsPx
                    ? {
                        backgroundColor: color.hex,
                        width: sliceWidthsPx[index],
                        flexShrink: 0,
                      }
                    : {
                        backgroundColor: color.hex,
                        flexGrow: Math.max(color.score ?? 0, 0.001),
                        flexBasis: 0,
                        minWidth: 4,
                      }
                }
                aria-label={`Copy ${color.hex} (${percent}%)`}
                onMouseEnter={() => setActiveHex(color.hex)}
                onMouseLeave={() =>
                  setActiveHex((prev) => (prev === color.hex ? null : prev))
                }
                onFocus={() => setActiveHex(color.hex)}
                onBlur={() =>
                  setActiveHex((prev) => (prev === color.hex ? null : prev))
                }
                onClick={() => void copyColor(color.hex)}
              />
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>
              {isCopied ? (
                <span className="font-mono">Copied!</span>
              ) : (
                <div className="flex items-center gap-2">
                  <div
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-sm border border-zinc-200/60 dark:border-zinc-700"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="font-mono">{color.hex}</span>
                  <span className="text-zinc-500">· {percent}%</span>
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </fieldset>
  );
}
