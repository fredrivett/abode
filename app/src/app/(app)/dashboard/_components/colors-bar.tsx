"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

  const totalScore = useMemo(
    () => colors.reduce((sum, color) => sum + (color.score ?? 0), 0) || 1,
    [colors],
  );

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

  const adjustedWidthsPx = useMemo(() => {
    if (!isHovered || !containerWidthPx) return null;
    return getAdjustedSliceWidthsPx({
      colors,
      containerWidthPx,
      minSlicePx,
    });
  }, [colors, containerWidthPx, isHovered, minSlicePx]);

  if (colors.length === 0) return null;

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

        return (
          <Tooltip key={`${color.hex}-${index}`}>
            <TooltipTrigger asChild>
              <div
                className="h-full cursor-help"
                style={
                  adjustedWidthsPx
                    ? {
                        backgroundColor: color.hex,
                        width: adjustedWidthsPx[index],
                        flexShrink: 0,
                      }
                    : {
                        backgroundColor: color.hex,
                        flexGrow: Math.max(color.score ?? 0, 0.001),
                        flexBasis: 0,
                        minWidth: 4,
                      }
                }
                role="img"
                aria-label={`${color.hex} ${percent}%`}
              />
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>
              <div className="flex items-center gap-2">
                <div
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 rounded-sm border border-zinc-200/60 dark:border-zinc-700"
                  style={{ backgroundColor: color.hex }}
                />
                <span className="font-mono">{color.hex}</span>
                <span className="text-zinc-500">· {percent}%</span>
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </fieldset>
  );
}
