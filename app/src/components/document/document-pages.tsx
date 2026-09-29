"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { DocumentPageSummary } from "@/lib/documents/document-pages";
import { getProxyImageUrl } from "@/lib/image-url";
import { isEditableTarget } from "@/lib/keyboard";

interface DocumentPagesProps {
  /** Pages in reading order; null until they've loaded */
  pages: DocumentPageSummary[] | null;
  /** From the item's meta, so the count shows before the pages load */
  pageCount: number;
  /** Page 1's image, shown while the rest load (or if they fail to) */
  coverUrl: string | null;
  status: "loading" | "error" | "ready";
  title: string;
}

interface Slide {
  key: string;
  src: string;
  width?: number;
  height?: number;
}

/**
 * A scanned document's pages side by side, one at a time: swipe (or use the
 * arrows) to page through, like the scanner's review screen.
 */
export function DocumentPages({
  pages,
  pageCount,
  coverUrl,
  status,
  title,
}: DocumentPagesProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const slides: Slide[] =
    pages && status === "ready"
      ? pages.map((page) => ({
          key: `page-${page.position}`,
          src: getProxyImageUrl(page.fileKey, "detail"),
          width: page.width,
          height: page.height,
        }))
      : coverUrl
        ? // Keyed as page 1 so the same <img> carries on once the pages load
          [{ key: "page-0", src: coverUrl }]
        : [];

  const lastIndex = slides.length - 1;
  // Where a key/arrow press is heading. Smooth scrolling updates `index` only
  // once it arrives, so without this a quick second press would aim at the
  // same page and collapse into the first
  const pendingRef = useRef<number | null>(null);

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track?.clientWidth) return;
    const current = Math.round(track.scrollLeft / track.clientWidth);
    setIndex(current);
    if (current === pendingRef.current) pendingRef.current = null;
  };

  /** Moves `step` pages from wherever the last press was heading */
  const step = (by: number) => {
    const target = (pendingRef.current ?? index) + by;
    const track = trackRef.current;
    if (!track || target < 0 || target > lastIndex) return;
    pendingRef.current = target;
    track.scrollTo({ left: target * track.clientWidth, behavior: "smooth" });
  };

  // ← / → page through the document while it's open, except mid-typing
  // (e.g. in the notes field or title) or with a modifier held
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      stepRef.current(event.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex h-[70dvh] w-full flex-col md:h-full">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        // A swipe or trackpad scroll takes over from any pending key press
        onPointerDown={() => {
          pendingRef.current = null;
        }}
        onWheel={() => {
          pendingRef.current = null;
        }}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none]"
      >
        {slides.map((slide, slideIndex) => (
          <div
            key={slide.key}
            className="flex h-full w-full shrink-0 snap-center items-center justify-center p-4 md:p-8"
          >
            {/* biome-ignore lint/performance/noImgElement: page images come through the item image proxy */}
            <img
              src={slide.src}
              alt={`${title}, page ${slideIndex + 1}`}
              width={slide.width}
              height={slide.height}
              loading={slideIndex === 0 ? "eager" : "lazy"}
              draggable={false}
              className="size-full object-contain drop-shadow-lg"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 p-3 text-sm text-white/70">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Previous page"
          disabled={index <= 0}
          onClick={() => step(-1)}
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <ChevronLeft />
        </Button>
        <span
          aria-live="polite"
          className="min-w-16 whitespace-nowrap text-center"
        >
          {index + 1} of {pageCount}
          {status === "error" ? " · failed to load other pages" : null}
        </span>
        {/* Loading shows in the arrow it blocks, so nothing shifts once it's done */}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={status === "loading" ? "Loading pages" : "Next page"}
          disabled={index >= slides.length - 1}
          onClick={() => step(1)}
          className="text-white hover:bg-white/10 hover:text-white"
        >
          {status === "loading" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <ChevronRight />
          )}
        </Button>
      </div>
    </div>
  );
}
