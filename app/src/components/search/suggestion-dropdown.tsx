"use client";

import { Kbd } from "@/components/ui/kbd";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import type { Suggestion } from "@/lib/search/detect-suggestions";
import type { Filter } from "@/lib/search/types";
import { cn } from "@/lib/utils";
import { FilterChip } from "./filter-chip";

function toPreviewFilter(suggestion: Suggestion): Filter {
  return {
    id: `${suggestion.facet}:${suggestion.value}`,
    type: suggestion.facet,
    value: suggestion.value,
    negated: false,
    dateOperator: suggestion.dateOperator,
    endDate: suggestion.endDate,
  };
}

type SuggestionDropdownProps = {
  open: boolean;
  suggestions: Suggestion[];
  onApply: (suggestion: Suggestion) => void;
  anchorRef: React.RefObject<HTMLInputElement | null>;
};

/**
 * A non-focus-stealing dropdown of free-text → filter suggestions, anchored to
 * the search input. The active (first) row shows a Tab hint; Tab (handled by
 * the input) applies it, clicking applies any. Focus never leaves the input.
 */
export function SuggestionDropdown({
  open,
  suggestions,
  onApply,
  anchorRef,
}: SuggestionDropdownProps) {
  if (!open || suggestions.length === 0) return null;

  const virtualRef = {
    current: anchorRef.current,
  } as React.RefObject<HTMLInputElement>;

  return (
    <Popover open>
      <PopoverAnchor virtualRef={anchorRef.current ? virtualRef : undefined} />
      <PopoverContent
        className="w-64 p-1"
        align="start"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {suggestions.map((suggestion, index) => (
          <button
            type="button"
            key={`${suggestion.facet}:${suggestion.value}`}
            onMouseDown={(e) => {
              // keep focus in the input
              e.preventDefault();
              e.stopPropagation();
              onApply(suggestion);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left outline-none",
              index === 0 ? "bg-accent" : "hover:bg-accent",
            )}
          >
            <FilterChip filter={toPreviewFilter(suggestion)} />
            {index === 0 && (
              <span className="ml-auto">
                <Kbd>Tab</Kbd>
              </span>
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
