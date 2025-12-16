"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  type Filter,
  type DateOperator,
  createFilterId,
} from "@/lib/search/types";
import type { DateRange } from "react-day-picker";

type DateRangePickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddFilter: (filter: Filter) => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
};

type DateMode = "single" | "before" | "after" | "range";

export function DateRangePicker({
  open,
  onOpenChange,
  onAddFilter,
  triggerRef,
}: DateRangePickerProps) {
  const [mode, setMode] = useState<DateMode>("single");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const handleModeChange = (newMode: DateMode) => {
    setMode(newMode);
    setSelectedDate(undefined);
    setDateRange(undefined);
  };

  const handleApply = () => {
    let filter: Filter | null = null;

    if (mode === "range" && dateRange?.from) {
      filter = {
        id: createFilterId(),
        type: "date",
        value: format(dateRange.from, "yyyy-MM-dd"),
        endDate: dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : format(dateRange.from, "yyyy-MM-dd"),
        negated: false,
        dateOperator: "between",
      };
    } else if (selectedDate) {
      const dateOperator: DateOperator =
        mode === "before" ? "before" : mode === "after" ? "after" : "is";

      filter = {
        id: createFilterId(),
        type: "date",
        value: format(selectedDate, "yyyy-MM-dd"),
        negated: false,
        dateOperator,
      };
    }

    if (filter) {
      onAddFilter(filter);
      // Reset state
      setMode("single");
      setSelectedDate(undefined);
      setDateRange(undefined);
      onOpenChange(false);
    }
  };

  const canApply =
    (mode === "range" && dateRange?.from) ||
    ((mode === "single" || mode === "before" || mode === "after") && selectedDate);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {triggerRef ? (
        <PopoverTrigger asChild>
          <span ref={triggerRef as React.RefObject<HTMLSpanElement>} />
        </PopoverTrigger>
      ) : null}
      <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
        <div className="p-3 space-y-3">
          {/* Mode selector */}
          <div className="flex gap-1">
            <Button
              variant={mode === "single" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleModeChange("single")}
            >
              On
            </Button>
            <Button
              variant={mode === "before" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleModeChange("before")}
            >
              Before
            </Button>
            <Button
              variant={mode === "after" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleModeChange("after")}
            >
              After
            </Button>
            <Button
              variant={mode === "range" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleModeChange("range")}
            >
              Range
            </Button>
          </div>

          {/* Calendar */}
          {mode === "range" ? (
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              disabled={{ after: new Date() }}
            />
          ) : (
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={{ after: new Date() }}
            />
          )}

          {/* Summary and apply */}
          <div className="flex items-center justify-between border-t pt-3">
            <div className="text-sm text-muted-foreground">
              {mode === "range" && dateRange?.from && (
                <>
                  {format(dateRange.from, "MMM d, yyyy")}
                  {dateRange.to && ` – ${format(dateRange.to, "MMM d, yyyy")}`}
                </>
              )}
              {mode !== "range" && selectedDate && (
                <>
                  {mode === "before" && "Before "}
                  {mode === "after" && "After "}
                  {format(selectedDate, "MMM d, yyyy")}
                </>
              )}
              {!canApply && "Select a date"}
            </div>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={!canApply}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
