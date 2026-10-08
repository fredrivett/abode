"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Img } from "@/components/ui/img";
import {
  type DocumentPageSummary,
  MAX_OCR_PAGES_PER_DOCUMENT,
} from "@/lib/documents/document-pages";
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
  /** Scanned pages left without text, so not found by search (owner-only note) */
  ocrSkippedPages?: number;
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
  ocrSkippedPages = 0,
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
        ? // Keyed as page 1 so the same <Img> carries on once the pages load
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
            <Img
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

      {/* The error sits beside the pager, wrapping below it whole on phones too
          narrow for both */}
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 p-3 text-muted-foreground text-sm">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous page"
            disabled={index <= 0}
            onClick={() => step(-1)}
            className="text-foreground"
          >
            <ChevronLeft />
          </Button>
          <span aria-live="polite" className="min-w-16 text-center">
            {index + 1} of {pageCount}
          </span>
          {/* Loading shows in the arrow it blocks, so nothing shifts once it's done */}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={status === "loading" ? "Loading pages" : "Next page"}
            disabled={index >= slides.length - 1}
            onClick={() => step(1)}
            className="text-foreground"
          >
            {status === "loading" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <ChevronRight />
            )}
          </Button>
        </div>
        {status === "error" ? (
          <span className="whitespace-nowrap">Failed to load other pages</span>
        ) : null}
        {ocrSkippedPages > 0 ? (
          <span className="basis-full text-center text-muted-foreground text-xs">
            {ocrSkippedPages} scanned {ocrSkippedPages === 1 ? "page" : "pages"}{" "}
            not searchable — text is read from up to{" "}
            {MAX_OCR_PAGES_PER_DOCUMENT} per document, within your daily limit
          </span>
        ) : null}
      </div>
    </div>
  );
}
