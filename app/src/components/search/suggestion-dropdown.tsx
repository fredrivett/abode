"use client";

import { useEffect, useState } from "react";
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
 * the search input. Up/Down move the active row and Tab applies it (via a
 * capture-phase listener that beats the input's own key handling and cmdk);
 * clicking or hovering also targets a row. Focus never leaves the input.
 */
export function SuggestionDropdown({
  open,
  suggestions,
  onApply,
  anchorRef,
}: SuggestionDropdownProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const active = open && suggestions.length > 0;

  // Reset the active row when the set of suggestions actually changes. Compare
  // by content, not array identity, so a new-but-equal array doesn't reset it.
  const signature = suggestions.map((s) => `${s.facet}:${s.value}`).join("|");
  const [seenSignature, setSeenSignature] = useState(signature);
  if (seenSignature !== signature) {
    setSeenSignature(signature);
    setSelectedIndex(0);
  }

  // Keyboard nav — capture phase so it intercepts before the input/cmdk.
  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, suggestions.length - 1),
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Tab":
          e.preventDefault();
          e.stopPropagation();
          onApply(suggestions[selectedIndex]);
          break;
      }
    };
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [active, suggestions, selectedIndex, onApply]);

  if (!active) return null;

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
            onMouseEnter={() => setSelectedIndex(index)}
            onMouseDown={(e) => {
              // keep focus in the input
              e.preventDefault();
              e.stopPropagation();
              onApply(suggestion);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left outline-none",
              index === selectedIndex ? "bg-accent" : "hover:bg-accent",
            )}
          >
            <FilterChip filter={toPreviewFilter(suggestion)} />
            {index === selectedIndex && (
              <span className="ml-auto">
                <Kbd className="bg-background">Tab</Kbd>
              </span>
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
