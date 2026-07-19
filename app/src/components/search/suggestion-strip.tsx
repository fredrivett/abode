"use client";

import { Kbd } from "@/components/ui/kbd";
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

type SuggestionStripProps = {
  suggestions: Suggestion[];
  onApply: (suggestion: Suggestion) => void;
  className?: string;
};

/**
 * A quiet, ignorable row under the search input previewing free-text →
 * filter conversions. Clicking a chip applies it; the input can also apply the
 * first via Tab. Nothing changes until the user opts in.
 */
export function SuggestionStrip({
  suggestions,
  onApply,
  className,
}: SuggestionStripProps) {
  if (suggestions.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 text-muted-foreground text-sm",
        className,
      )}
    >
      <span>filter by</span>
      {suggestions.map((suggestion) => (
        <button
          key={`${suggestion.facet}:${suggestion.value}`}
          type="button"
          onClick={() => onApply(suggestion)}
          className="rounded-md opacity-90 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
        >
          <FilterChip filter={toPreviewFilter(suggestion)} />
        </button>
      ))}
      <span className="ml-0.5 inline-flex items-center gap-1">
        <Kbd>Tab</Kbd> to apply
      </span>
    </div>
  );
}
