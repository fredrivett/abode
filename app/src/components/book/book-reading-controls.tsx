"use client";

import type { BookReadingStatus } from "@prisma/client";
import { format } from "date-fns";
import { CalendarIcon, ChevronDown, Star, X } from "lucide-react";
import posthog from "posthog-js";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/lib/api-client";
import { useInvalidateItems } from "@/lib/api-hooks";
import { BOOK_READING_STATUS_LABELS } from "@/lib/items/book-reading-status";
import type { BookDetails } from "@/lib/types/item";
import { cn } from "@/lib/utils";

const STATUS_ORDER: BookReadingStatus[] = [
  "want_to_read",
  "reading",
  "read",
  "dnf",
];

// Rating is stored /10 (half-stars); the UI currently offers whole stars only,
// so a click on star N persists N*2. Half-star entry can be layered on later
// without a storage change.
const STARS = [1, 2, 3, 4, 5];

type ReadingState = Pick<
  BookDetails,
  | "status"
  | "startedAt"
  | "finishedAt"
  | "progressValue"
  | "progressUnit"
  | "rating"
>;

function toReadingState(book: BookDetails): ReadingState {
  return {
    status: book.status,
    startedAt: book.startedAt,
    finishedAt: book.finishedAt,
    progressValue: book.progressValue,
    progressUnit: book.progressUnit,
    rating: book.rating,
  };
}

type BookReadingControlsProps = {
  itemId: string;
  bookDetails: BookDetails;
  className?: string;
};

/**
 * Editable reading lifecycle for a book: status, progress, rating, and
 * started/finished dates. Progressively reveals progress + rating + dates once
 * the book is at least "reading". Persists each change to the item PATCH
 * endpoint with optimistic local state.
 */
export function BookReadingControls({
  itemId,
  bookDetails,
  className,
}: BookReadingControlsProps) {
  const invalidateItems = useInvalidateItems();
  const [state, setState] = useState<ReadingState>(() =>
    toReadingState(bookDetails),
  );

  // Re-sync from server after a save invalidates the items query (mirrors the
  // notes/tags pattern elsewhere in the detail modal).
  useEffect(() => {
    setState(toReadingState(bookDetails));
  }, [bookDetails]);

  const hasPages =
    bookDetails.pageCount != null && bookDetails.pageCount > 0
      ? bookDetails.pageCount
      : null;
  // Percent is forced when we have no page count; otherwise it's an optional
  // display lens over page-based storage (kept lossless — see save below).
  const [percentView, setPercentView] = useState(hasPages === null);

  // Optimistically apply the change, persist in the background, and revert on
  // failure. Returns void so callers don't create floating promises.
  const save = (partial: Partial<ReadingState>) => {
    const prev = state;
    setState({ ...state, ...partial });
    void (async () => {
      try {
        await api.patch(`/api/v1/items/${itemId}`, { bookReading: partial });
        invalidateItems();
      } catch {
        setState(prev);
        toast.error("Failed to update reading status");
      }
    })();
  };

  const setStatus = (status: BookReadingStatus | null) => {
    save({ status });
    if (status)
      posthog.capture("item_reading_status_updated", {
        item_id: itemId,
        status,
      });
  };

  // Progress persistence is debounced and coalesced: a rapid slider drag fires
  // many onChange events, but only the final value is written (one request, in
  // order), avoiding out-of-order PATCHes stamping a stale position. Optimistic
  // local state still updates on every event so the slider stays responsive.
  const commitProgress = useDebouncedCallback(
    (partial: Partial<ReadingState>, percent: number | null) => {
      void (async () => {
        try {
          await api.patch(`/api/v1/items/${itemId}`, { bookReading: partial });
          invalidateItems();
          posthog.capture("item_reading_progress_updated", {
            item_id: itemId,
            percent,
          });
        } catch {
          setState(toReadingState(bookDetails));
          toast.error("Failed to update reading status");
        }
      })();
    },
    400,
  );

  // When we have a page count we always store the exact page (lossless); percent
  // is only stored when there's no page count to convert against.
  const saveProgressFromPercent = (percent: number) => {
    const partial: Partial<ReadingState> =
      hasPages !== null
        ? {
            progressValue: Math.round((percent / 100) * hasPages),
            progressUnit: "page",
          }
        : { progressValue: percent, progressUnit: "percent" };
    setState((s) => ({ ...s, ...partial }));
    commitProgress(partial, percent);
  };

  const saveProgressFromPage = (page: number) => {
    const clamped =
      hasPages !== null
        ? Math.min(Math.max(page, 0), hasPages)
        : Math.max(page, 0);
    const partial: Partial<ReadingState> = {
      progressValue: clamped,
      progressUnit: "page",
    };
    setState((s) => ({ ...s, ...partial }));
    commitProgress(
      partial,
      hasPages !== null ? Math.round((clamped / hasPages) * 100) : null,
    );
  };

  const setRating = (rating: number | null) => {
    save({ rating });
    posthog.capture("item_reading_rating_updated", { item_id: itemId, rating });
  };

  const status = state.status;
  const isTracking =
    status === "reading" || status === "read" || status === "dnf";
  const showProgress = status === "reading";
  const showFinished = status === "read" || status === "dnf";

  // Derived progress display values.
  const storedIsPercent = state.progressUnit === "percent";
  const storedValue = state.progressValue ?? 0;
  const currentPercent =
    storedIsPercent || hasPages === null
      ? storedValue
      : Math.round((storedValue / hasPages) * 100);
  const currentPage =
    hasPages === null
      ? 0
      : storedIsPercent
        ? Math.round((storedValue / 100) * hasPages)
        : storedValue;
  const usePercentSlider = percentView || hasPages === null;
  const sliderMax = usePercentSlider ? 100 : hasPages;
  const sliderValue = usePercentSlider ? currentPercent : currentPage;
  const filledStars = state.rating != null ? Math.round(state.rating / 2) : 0;

  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="font-semibold text-gray-700 text-sm dark:text-gray-300">
        Reading
      </h3>

      {/* Status */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between"
          >
            {status ? BOOK_READING_STATUS_LABELS[status] : "Not tracked"}
            <ChevronDown className="size-4 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[--radix-dropdown-menu-trigger-width]"
        >
          <DropdownMenuRadioGroup
            value={status ?? ""}
            onValueChange={(v) => setStatus(v as BookReadingStatus)}
          >
            {STATUS_ORDER.map((s) => (
              <DropdownMenuRadioItem key={s} value={s}>
                {BOOK_READING_STATUS_LABELS[s]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {status && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setStatus(null)}>
                Clear status
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Started date */}
      {isTracking && (
        <ReadingDateField
          label="Started"
          value={state.startedAt}
          onChange={(iso) => save({ startedAt: iso })}
        />
      )}

      {/* Progress (while reading) */}
      {showProgress && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-gray-500 text-xs">
            <span>Progress</span>
            <div className="flex items-center gap-2">
              <span className="tabular-nums">
                {hasPages !== null && !usePercentSlider
                  ? `p.${currentPage} of ${hasPages}`
                  : `${currentPercent}%`}
              </span>
              {hasPages !== null && (
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setPercentView((v) => !v)}
                >
                  {usePercentSlider ? "Pages" : "%"}
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={sliderMax}
              value={sliderValue}
              onChange={(e) =>
                usePercentSlider
                  ? saveProgressFromPercent(Number(e.target.value))
                  : saveProgressFromPage(Number(e.target.value))
              }
              onPointerUp={() => commitProgress.flush()}
              onKeyUp={() => commitProgress.flush()}
              className="h-1.5 w-full cursor-pointer accent-primary"
              aria-label="Reading progress"
            />
            <input
              type="number"
              min={0}
              max={sliderMax}
              value={sliderValue}
              onChange={(e) =>
                usePercentSlider
                  ? saveProgressFromPercent(Number(e.target.value))
                  : saveProgressFromPage(Number(e.target.value))
              }
              onBlur={() => commitProgress.flush()}
              className="w-16 rounded-md border bg-transparent px-2 py-1 text-right text-sm tabular-nums"
              aria-label="Reading progress value"
            />
          </div>
        </div>
      )}

      {/* Finished date */}
      {showFinished && (
        <ReadingDateField
          label="Finished"
          value={state.finishedAt}
          onChange={(iso) => save({ finishedAt: iso })}
        />
      )}

      {/* Rating */}
      {isTracking && (
        <div className="flex items-center justify-between">
          <span className="text-gray-500 text-xs">Rating</span>
          <div className="flex items-center gap-0.5">
            {STARS.map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
                onClick={() => setRating(n * 2)}
                className="p-0.5"
              >
                <Star
                  className={cn(
                    "size-4",
                    n <= filledStars
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300 dark:text-gray-600",
                  )}
                />
              </button>
            ))}
            {state.rating != null && (
              <button
                type="button"
                aria-label="Clear rating"
                onClick={() => setRating(null)}
                className="ml-1 text-gray-400 hover:text-gray-600"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type ReadingDateFieldProps = {
  label: string;
  value: string | null;
  onChange: (iso: string | null) => void;
};

function ReadingDateField({ label, value, onChange }: ReadingDateFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value) : undefined;

  const pick = (date: Date | undefined) => {
    onChange(date ? date.toISOString() : null);
    setOpen(false);
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 text-xs">{label}</span>
      <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-sm"
            >
              <CalendarIcon className="size-3.5 opacity-60" />
              {selected ? format(selected, "MMM d, yyyy") : "Set date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="border-b p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => pick(new Date())}
              >
                Today
              </Button>
            </div>
            <Calendar
              mode="single"
              selected={selected}
              onSelect={pick}
              disabled={{ after: new Date() }}
              autoFocus
            />
          </PopoverContent>
        </Popover>
        {selected && (
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()} date`}
            onClick={() => onChange(null)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
