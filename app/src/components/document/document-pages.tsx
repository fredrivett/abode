"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import type { DocumentPageSummary } from "@/lib/documents/document-pages";
import { getProxyImageUrl } from "@/lib/image-url";

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
          key: page.fileKey,
          src: getProxyImageUrl(page.fileKey, "detail"),
          width: page.width,
          height: page.height,
        }))
      : coverUrl
        ? [{ key: "cover", src: coverUrl }]
        : [];

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track?.clientWidth) return;
    setIndex(Math.round(track.scrollLeft / track.clientWidth));
  };

  const goTo = (target: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: target * track.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="flex h-[70dvh] w-full flex-col md:h-full">
      <div
        ref={trackRef}
        onScroll={handleScroll}
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
          onClick={() => goTo(index - 1)}
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <ChevronLeft />
        </Button>
        <span aria-live="polite" className="min-w-16 text-center">
          {index + 1} of {pageCount}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next page"
          disabled={index >= slides.length - 1}
          onClick={() => goTo(index + 1)}
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <ChevronRight />
        </Button>
      </div>
      {status === "loading" ? (
        <IsLoading
          label="Loading pages"
          className="justify-center pb-3 text-sm text-white/70"
        />
      ) : null}
      {status === "error" ? (
        <p className="pb-3 text-center text-sm text-white/70">
          Couldn't load the rest of this document's pages.
        </p>
      ) : null}
    </div>
  );
}
