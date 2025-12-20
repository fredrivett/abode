"use client";

import { Filter as FilterIcon, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  createFilterId,
  FILTER_TYPES,
  type Filter,
  type FilterType,
  type SearchState,
} from "@/lib/search/types";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "./date-range-picker";
import { FilterChips } from "./filter-chip";
import { FilterDropdown } from "./filter-dropdown";

type SearchInputProps = {
  value: SearchState;
  onChange: (state: SearchState) => void;
  getFilterValues?: (type: FilterType) => Promise<string[]>;
  placeholder?: string;
  className?: string;
  /** When true, input and filters are disabled (view-only mode). */
  disabled?: boolean;
};

// Parse the current filter context from the query string
function parseFilterContext(query: string): {
  mode: "none" | "types" | "values";
  filterType: FilterType | null;
  searchText: string;
  prefixEnd: number; // position where the @ starts
} {
  // Find the last @ that starts a filter
  const lastAtIndex = query.lastIndexOf("@");

  if (lastAtIndex === -1) {
    return { mode: "none", filterType: null, searchText: "", prefixEnd: 0 };
  }

  const isAtStartOfQuery = lastAtIndex === 0;
  const isAfterSpace = query[lastAtIndex - 1] === " ";
  const isValidFilterStart = isAtStartOfQuery || isAfterSpace;
  if (!isValidFilterStart) {
    return { mode: "none", filterType: null, searchText: "", prefixEnd: 0 };
  }

  const afterAt = query.slice(lastAtIndex + 1);

  // Check if there's a colon (filter type selected)
  const colonIndex = afterAt.indexOf(":");

  if (colonIndex === -1) {
    const filterAbandoned = afterAt.includes(" ");
    if (filterAbandoned) {
      return { mode: "none", filterType: null, searchText: "", prefixEnd: 0 };
    }
    return {
      mode: "types",
      filterType: null,
      searchText: afterAt,
      prefixEnd: lastAtIndex,
    };
  }

  const typePart = afterAt.slice(0, colonIndex);
  const valuePart = afterAt.slice(colonIndex + 1);
  const filterAbandoned = valuePart.includes(" ");
  if (filterAbandoned) {
    return { mode: "none", filterType: null, searchText: "", prefixEnd: 0 };
  }

  if (typePart in FILTER_TYPES) {
    return {
      mode: "values",
      filterType: typePart as FilterType,
      searchText: valuePart,
      prefixEnd: lastAtIndex,
    };
  }

  return { mode: "none", filterType: null, searchText: "", prefixEnd: 0 };
}

export function SearchInput({
  value,
  onChange,
  getFilterValues,
  placeholder = "Find...",
  className,
  disabled = false,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dateFilterAppliedRef = useRef(false);

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
    // Insert @ at the end of query to trigger filter dropdown
    const newQuery =
      value.query.trimEnd() +
      (value.query.endsWith(" ") || !value.query ? "@" : " @");
    onChange({ ...value, query: newQuery });
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
        <div className="flex min-w-48 flex-1 items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={value.query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={placeholder}
              aria-label="Search"
              className={cn(
                "w-full rounded-none border-0 border-b bg-transparent px-0 py-1 font-serif shadow-none placeholder:italic placeholder:opacity-60 focus-visible:border-input focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent md:text-lg",
                disabled && "cursor-not-allowed opacity-50",
              )}
            />
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
