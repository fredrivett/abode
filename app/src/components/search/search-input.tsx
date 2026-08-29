"use client";

import { Filter as FilterIcon, RefreshCw } from "lucide-react";
import posthog from "posthog-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { getModifierKeySymbol, matchesShortcut } from "@/lib/keyboard";
import type { FiltersResponse } from "@/lib/search/api";
import { removeSpan, type Suggestion } from "@/lib/search/detect-suggestions";
import { getFilterTriggerQuery } from "@/lib/search/get-filter-trigger-query";
import { parseFilterContext } from "@/lib/search/parse-filter-context";
import {
  createFilterId,
  FILTER_TYPES,
  type Filter,
  type FilterType,
  type SearchState,
} from "@/lib/search/types";
import { useFilterSuggestions } from "@/lib/search/use-filter-suggestions";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "./date-range-picker";
import { FilterChips } from "./filter-chip";
import { FilterDropdown } from "./filter-dropdown";
import { SuggestionDropdown } from "./suggestion-dropdown";

type SearchInputProps = {
  value: SearchState;
  onChange: (state: SearchState) => void;
  getFilterValues?: (type: FilterType) => Promise<string[]>;
  /** All known filter values; when provided, free-text is offered as filter suggestions. */
  filterOptions?: FiltersResponse;
  placeholder?: string;
  className?: string;
  /** When true, input and filters are disabled (view-only mode). */
  disabled?: boolean;
  /** When true, registers cmd+shift+k to focus this input and shows the shortcut hint. */
  focusShortcut?: boolean;
};

export function SearchInput({
  value,
  onChange,
  getFilterValues,
  filterOptions,
  placeholder = "Find...",
  className,
  disabled = false,
  focusShortcut = false,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dateFilterAppliedRef = useRef(false);

  // Track focus state for showing shortcut hint
  const [isFocused, setIsFocused] = useState(false);

  // Values loaded from API
  const [filterValues, setFilterValues] = useState<string[]>([]);
  const [loadingValues, setLoadingValues] = useState(false);

  // Parse current filter context from query
  const filterContext = parseFilterContext(value.query);

  const isSelectingFilterType = filterContext.mode === "types";
  const isSelectingNonDateValue =
    filterContext.mode === "values" && filterContext.filterType !== "date";
  const dropdownOpen = isSelectingFilterType || isSelectingNonDateValue;

  const datePickerOpen =
    filterContext.mode === "values" && filterContext.filterType === "date";

  // Free-text → filter suggestions (off while an @-dropdown/date picker is open)
  const { suggestions, markAccepted } = useFilterSuggestions({
    query: value.query,
    filterOptions,
    filters: value.filters,
    surface: "search-input",
    // gated on focus so the session aligns with the visible dropdown and ends
    // (dismissed if unaccepted) on blur
    enabled:
      isFocused &&
      !disabled &&
      !dropdownOpen &&
      !datePickerOpen &&
      value.query.trim().length > 0,
  });

  // Load filter values when entering values mode (for non-date types)
  useEffect(() => {
    if (
      filterContext.mode === "values" &&
      filterContext.filterType &&
      filterContext.filterType !== "date" &&
      getFilterValues
    ) {
      setLoadingValues(true);
      getFilterValues(filterContext.filterType)
        .then(setFilterValues)
        .catch(() => setFilterValues([]))
        .finally(() => setLoadingValues(false));
    } else if (filterContext.mode !== "values") {
      setFilterValues([]);
    }
  }, [filterContext.mode, filterContext.filterType, getFilterValues]);

  // Register cmd+shift+k to focus this input (when focusShortcut is enabled)
  useEffect(() => {
    if (!focusShortcut) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesShortcut(e, { key: "k", modifier: true, shift: true })) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [focusShortcut]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, query: e.target.value });
  };

  const handleSelectFilterType = useCallback(
    (type: FilterType) => {
      // Insert @type: into the query (for all types including date)
      const beforeFilter = value.query.slice(0, filterContext.prefixEnd);
      const newQuery = `${beforeFilter}@${type}:`;
      onChange({ ...value, query: newQuery });

      // Keep focus on input
      inputRef.current?.focus();
    },
    [value, onChange, filterContext.prefixEnd],
  );

  // Helper to add a filter, replacing existing ones if the type doesn't allow multiple
  const addFilterToList = useCallback(
    (filters: Filter[], newFilter: Filter): Filter[] => {
      const filterMeta = FILTER_TYPES[newFilter.type];
      if (filterMeta.multiple) {
        return [...filters, newFilter];
      }
      // Single only - replace any existing filter of the same type
      const existingFilter = filters.find((f) => f.type === newFilter.type);
      if (existingFilter) {
        toast(
          <span>
            Replaced "{existingFilter.value}" — only one{" "}
            {filterMeta.label.toLowerCase()} filter allowed.{" "}
            <a
              href="/help/filtering"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:no-underline"
            >
              Want OR queries? Use pipes
            </a>
          </span>,
          {
            icon: (
              <RefreshCw className="size-4 animate-[spin_0.7s_ease-in-out_0.15s_1]" />
            ),
          },
        );
      }
      const withoutExisting = filters.filter((f) => f.type !== newFilter.type);
      return [...withoutExisting, newFilter];
    },
    [],
  );

  const handleSelectFilterValue = useCallback(
    (filterValue: string) => {
      if (!filterContext.filterType) return;

      // Create the filter
      const newFilter: Filter = {
        id: createFilterId(),
        type: filterContext.filterType,
        value: filterValue,
        negated: false,
      };

      // Remove the @type:value part from query
      const newQuery = value.query.slice(0, filterContext.prefixEnd).trimEnd();

      onChange({
        query: newQuery,
        filters: addFilterToList(value.filters, newFilter),
      });

      inputRef.current?.focus();
    },
    [value, onChange, filterContext, addFilterToList],
  );

  // Promote a free-text suggestion to a filter: strip its span from the query
  // and add the filter (same "replaces the text" semantics as the demo).
  const handleApplySuggestion = useCallback(
    (suggestion: Suggestion) => {
      const newFilter: Filter = {
        id: createFilterId(),
        type: suggestion.facet,
        value: suggestion.value,
        negated: false,
        dateOperator: suggestion.dateOperator,
        endDate: suggestion.endDate,
      };
      onChange({
        query: removeSpan(value.query, suggestion.start, suggestion.end),
        filters: addFilterToList(value.filters, newFilter),
      });
      markAccepted();
      posthog.capture("search_suggestion_accepted", {
        surface: "search-input",
        facet: suggestion.facet,
      });
      inputRef.current?.focus();
    },
    [value, onChange, addFilterToList, markAccepted],
  );

  const handleAddDateFilter = useCallback(
    (filter: Filter, _displayValue: string) => {
      // Mark that we just applied a date filter so handleCloseDatePicker doesn't clear it
      dateFilterAppliedRef.current = true;

      // Remove the @date: part from query (same as other filters)
      const newQuery = value.query.slice(0, filterContext.prefixEnd).trimEnd();
      const newFilters = addFilterToList(value.filters, filter);

      onChange({
        query: newQuery,
        filters: newFilters,
      });

      inputRef.current?.focus();
    },
    [value, onChange, filterContext.prefixEnd, addFilterToList],
  );

  const handleRemoveFilter = useCallback(
    (id: string) => {
      onChange({
        ...value,
        filters: value.filters.filter((f) => f.id !== id),
      });
      inputRef.current?.focus();
    },
    [value, onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget;

    if (e.key === "Escape") {
      e.preventDefault();
      // Close an open filter dropdown first (strip incomplete @filter syntax)
      if (dropdownOpen) {
        handleCloseDropdown();
        return;
      }
      // Clear the search when there's anything to clear
      if (value.query.length > 0 || value.filters.length > 0) {
        onChange({ query: "", filters: [] });
        return;
      }
      // Nothing to clear — blur the input
      input.blur();
      return;
    }

    // Backspace at start removes last filter
    const cursorAtStart =
      input.selectionStart === 0 && input.selectionEnd === 0;
    const isBackspaceAtStart = e.key === "Backspace" && cursorAtStart;
    const hasFiltersToRemove = value.filters.length > 0;
    if (isBackspaceAtStart && hasFiltersToRemove) {
      e.preventDefault();
      const lastFilter = value.filters[value.filters.length - 1];
      handleRemoveFilter(lastFilter.id);
    }
  };

  const handleFilterButtonClick = useCallback(() => {
    const newQuery = getFilterTriggerQuery(value.query);
    if (newQuery !== null) {
      onChange({ ...value, query: newQuery });
    }
    inputRef.current?.focus();
  }, [value, onChange]);

  const handleCloseDropdown = useCallback(() => {
    // Remove the incomplete filter syntax
    if (filterContext.prefixEnd > 0 || filterContext.mode !== "none") {
      const newQuery = value.query.slice(0, filterContext.prefixEnd).trimEnd();
      onChange({ ...value, query: newQuery });
    }
  }, [value, onChange, filterContext.prefixEnd, filterContext.mode]);

  const handleCloseDatePicker = useCallback(
    (open: boolean) => {
      if (!open) {
        // If we just applied a date filter, don't clear anything - reset the flag and return
        if (dateFilterAppliedRef.current) {
          dateFilterAppliedRef.current = false;
          return;
        }
        // Otherwise, user cancelled - clear the @date: from the query
        const newQuery = value.query
          .slice(0, filterContext.prefixEnd)
          .trimEnd();
        onChange({ ...value, query: newQuery });
      }
    },
    [value, onChange, filterContext.prefixEnd],
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsideContainer = containerRef.current?.contains(target);
      const popoverContent = document.querySelector(
        "[data-radix-popper-content-wrapper]",
      );
      const isInsidePopover = popoverContent?.contains(target);

      const isClickOutside = !isInsideContainer && !isInsidePopover;
      if (isClickOutside && dropdownOpen) {
        handleCloseDropdown();
      }
    };

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen, handleCloseDropdown]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Filter chips */}
        <FilterChips
          filters={value.filters}
          onRemove={disabled ? undefined : handleRemoveFilter}
        />

        {/* Input + filter button wrapper - stays together when wrapping */}
        <div className="flex min-w-52 flex-1 items-center gap-2">
          <div className="relative flex flex-1 items-center">
            <input
              ref={inputRef}
              type="text"
              value={value.query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={disabled}
              placeholder={placeholder}
              aria-label="Search"
              className={cn(
                "w-full rounded-none border-0 border-b-2 bg-transparent px-0 py-1 font-serif shadow-none placeholder:italic placeholder:opacity-60 focus-visible:border-foreground/30 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 md:text-lg dark:bg-transparent",
                disabled && "cursor-not-allowed opacity-50",
                focusShortcut && "pr-16",
              )}
            />
            {/* Keyboard shortcut hint (shown when not focused, hidden on mobile) */}
            {focusShortcut && !isFocused && (
              <div className="pointer-events-none absolute right-0 flex">
                <KbdGroup className="hidden md:inline-flex">
                  <Kbd>{getModifierKeySymbol()}</Kbd>
                  <Kbd>⇧</Kbd>
                  <Kbd>K</Kbd>
                </KbdGroup>
              </div>
            )}
          </div>

          {/* Mobile filter button */}
          {!disabled && (
            <Button
              variant="ghost-subtle"
              size="icon"
              className="shrink-0 md:hidden"
              onClick={handleFilterButtonClick}
              aria-label="Add filter"
            >
              <FilterIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Free-text → filter suggestions */}
      <SuggestionDropdown
        open={isFocused}
        suggestions={suggestions}
        onApply={handleApplySuggestion}
        anchorRef={inputRef}
      />

      {/* Filter dropdown (for types and non-date values) */}
      <FilterDropdown
        open={dropdownOpen}
        onClose={handleCloseDropdown}
        mode={filterContext.mode === "types" ? "types" : "values"}
        currentFilterType={filterContext.filterType}
        searchText={filterContext.searchText}
        filterValues={filterValues}
        loadingValues={loadingValues}
        onSelectType={handleSelectFilterType}
        onSelectValue={handleSelectFilterValue}
        anchorRef={inputRef}
      />

      {/* Date range picker (shown when @date: is typed) */}
      <DateRangePicker
        open={datePickerOpen}
        onOpenChange={handleCloseDatePicker}
        onAddFilter={handleAddDateFilter}
        anchorRef={inputRef}
      />
    </div>
  );
}
