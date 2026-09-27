"use client";

import {
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  RefreshCcw,
  RotateCw,
  Trash2,
} from "lucide-react";
import { type ReactNode, useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import {
  SCAN_FILTER_LABELS,
  SCAN_FILTERS,
  type ScanFilter,
} from "@/lib/scanner/filters";
import { previewKey, type ScanPage } from "@/lib/scanner/pages";
import { cn } from "@/lib/utils";
import { PageSlide } from "./page-slide";
import type { ScreenRect } from "./scanner-camera";
import { useElementSize } from "./use-element-size";
import type { PagePreview } from "./use-page-previews";

/** Breathing room around the page in the carousel */
const SLIDE_PADDING = 24;

const REVIEW_MODES = [
  { value: "edit", label: "Edit" },
  { value: "arrange", label: "Arrange" },
] as const;

export interface PageFlight {
  pageId: string;
  from: ScreenRect;
}

interface ScannerReviewProps {
  pages: ScanPage[];
  previews: ReadonlyMap<string, PagePreview>;
  /** Preview keys whose render failed */
  failedPreviews: ReadonlySet<string>;
  onRetryPreview: (page: ScanPage) => void;
  activeId: string | null;
  onActiveChange: (id: string) => void;
  flight: PageFlight | null;
  onFlightEnd: () => void;
  onAddPage: () => void;
  /** False once the document has the most pages allowed */
  canAddPage: boolean;
  onRetake: (id: string) => void;
  onDelete: (id: string) => void;
  onRotate: (id: string) => void;
  onFilterChange: (args: { id: string; filter: ScanFilter }) => void;
  onMove: (args: { id: string; to: number }) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-w-16 flex-col items-center gap-1 rounded-md px-2 py-1.5 text-white/90 text-xs transition-colors hover:bg-white/10 disabled:opacity-40 [&_svg]:size-5"
    >
      {children}
      {label}
    </button>
  );
}

/** Review scanned pages: flip through, filter, rotate, retake, reorder */
export function ScannerReview({
  pages,
  previews,
  failedPreviews,
  onRetryPreview,
  activeId,
  onActiveChange,
  flight,
  onFlightEnd,
  onAddPage,
  canAddPage,
  onRetake,
  onDelete,
  onRotate,
  onFilterChange,
  onMove,
  onCancel,
  onSave,
  saving,
}: ScannerReviewProps) {
  const [mode, setMode] = useState<"edit" | "arrange">("edit");
  const {
    ref: carouselRef,
    element: carousel,
    size: carouselSize,
  } = useElementSize<HTMLDivElement>();
  const activeIndex = Math.max(
    0,
    pages.findIndex((page) => page.id === activeId),
  );
  const activePage = pages[activeIndex];

  // Keep the carousel on the active page when it changes from outside a swipe.
  // A layout effect, so a just-captured page is scrolled into place before its
  // slide measures where to fly to
  useLayoutEffect(() => {
    const width = carouselSize?.width;
    if (!carousel || mode !== "edit" || !width) return;
    const scrolledIndex = Math.round(carousel.scrollLeft / width);
    if (scrolledIndex !== activeIndex) {
      carousel.scrollTo({ left: activeIndex * width });
    }
  }, [activeIndex, mode, carousel, carouselSize?.width]);

  const handleScroll = () => {
    if (!carousel?.clientWidth) return;
    const index = Math.round(carousel.scrollLeft / carousel.clientWidth);
    const page = pages[index];
    if (page && page.id !== activeId) onActiveChange(page.id);
  };

  const box = carouselSize
    ? {
        width: Math.max(1, carouselSize.width - SLIDE_PADDING * 2),
        height: Math.max(1, carouselSize.height - SLIDE_PADDING * 2),
      }
    : null;

  return (
    <div className="flex size-full flex-col bg-neutral-900 text-white">
      <div className="grid grid-cols-3 items-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div>
          <Button
            variant="ghost"
            onClick={onCancel}
            className="text-white hover:bg-white/10 hover:text-white"
          >
            Cancel
          </Button>
        </div>
        <div className="flex justify-center">
          <fieldset className="flex rounded-lg border-0 bg-white/10 p-0.5 text-sm">
            <legend className="sr-only">Review mode</legend>
            {REVIEW_MODES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  "rounded-md px-3 py-1 transition-colors",
                  mode === value ? "bg-white/25" : "text-white/70",
                )}
              >
                {label}
              </button>
            ))}
          </fieldset>
        </div>
        <div className="flex justify-end">
          <Button onClick={onSave} disabled={saving || pages.length === 0}>
            {saving ? <IsLoading label="Saving" /> : "Save"}
          </Button>
        </div>
      </div>

      {mode === "edit" ? (
        <>
          <p className="text-center text-sm text-white/70" aria-live="polite">
            {activeIndex + 1} of {pages.length}
          </p>
          <div
            ref={carouselRef}
            onScroll={handleScroll}
            className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none]"
          >
            {pages.map((page, index) => {
              const pageFlight =
                flight?.pageId === page.id
                  ? previews.get(previewKey({ page, filter: "original" }))
                  : undefined;
              return (
                <div
                  key={page.id}
                  className="flex h-full w-full shrink-0 snap-center items-center justify-center"
                >
                  {box ? (
                    <PageSlide
                      preview={previews.get(previewKey({ page }))}
                      box={box}
                      flight={
                        flight && pageFlight
                          ? { from: flight.from, colour: pageFlight }
                          : null
                      }
                      onFlightEnd={onFlightEnd}
                      failed={failedPreviews.has(previewKey({ page }))}
                      onRetry={() => onRetryPreview(page)}
                      alt={`Page ${index + 1}`}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>

          {activePage ? (
            <div className="space-y-3 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <fieldset className="mx-auto flex w-fit rounded-lg border-0 bg-white/10 p-0.5 text-sm">
                <legend className="sr-only">Filter</legend>
                {SCAN_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    aria-pressed={activePage.filter === filter}
                    onClick={() =>
                      onFilterChange({ id: activePage.id, filter })
                    }
                    className={cn(
                      "rounded-md px-3 py-1 transition-colors",
                      activePage.filter === filter
                        ? "bg-white/25"
                        : "text-white/70",
                    )}
                  >
                    {SCAN_FILTER_LABELS[filter]}
                  </button>
                ))}
              </fieldset>
              <div className="flex justify-around">
                <ToolbarButton
                  label="Add page"
                  onClick={onAddPage}
                  disabled={!canAddPage}
                >
                  <FilePlus2 />
                </ToolbarButton>
                <ToolbarButton
                  label="Rotate"
                  onClick={() => onRotate(activePage.id)}
                >
                  <RotateCw />
                </ToolbarButton>
                <ToolbarButton
                  label="Retake"
                  onClick={() => onRetake(activePage.id)}
                >
                  <RefreshCcw />
                </ToolbarButton>
                <ToolbarButton
                  label="Delete"
                  onClick={() => onDelete(activePage.id)}
                >
                  <Trash2 />
                </ToolbarButton>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {pages.map((page, index) => {
              const preview = previews.get(previewKey({ page }));
              const failed =
                !preview && failedPreviews.has(previewKey({ page }));
              return (
                <li key={page.id} className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      onActiveChange(page.id);
                      setMode("edit");
                    }}
                    aria-label={`Open page ${index + 1}`}
                    className={cn(
                      "flex aspect-[3/4] w-full items-center justify-center rounded-md bg-white/5 p-2",
                      page.id === activeId && "ring-2 ring-sky-400",
                    )}
                  >
                    {preview ? (
                      // biome-ignore lint/performance/noImgElement: blob: URL of a scan rendered in the browser; next/image can't load it
                      <img
                        src={preview.url}
                        alt=""
                        className="max-h-full max-w-full object-contain shadow-lg"
                      />
                    ) : failed ? (
                      <span className="text-center text-white/70 text-xs">
                        Couldn't prepare page
                      </span>
                    ) : (
                      <IsLoading label="Loading" className="text-white/70" />
                    )}
                  </button>
                  <div className="flex items-center justify-between text-sm text-white/80">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move page ${index + 1} earlier`}
                      disabled={index === 0}
                      onClick={() => onMove({ id: page.id, to: index - 1 })}
                      className="text-white hover:bg-white/10 hover:text-white"
                    >
                      <ChevronLeft />
                    </Button>
                    {failed ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRetryPreview(page)}
                        aria-label={`Try page ${index + 1} again`}
                        className="text-white hover:bg-white/10 hover:text-white"
                      >
                        Try again
                      </Button>
                    ) : (
                      index + 1
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move page ${index + 1} later`}
                      disabled={index === pages.length - 1}
                      onClick={() => onMove({ id: page.id, to: index + 1 })}
                      className="text-white hover:bg-white/10 hover:text-white"
                    >
                      <ChevronRight />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
