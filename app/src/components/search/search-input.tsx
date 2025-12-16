"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Filter as FilterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type Filter,
  type FilterType,
  type SearchState,
  FILTER_TYPES,
  createFilterId,
} from "@/lib/search/types";
import { FilterChips } from "./filter-chip";
import { FilterDropdown } from "./filter-dropdown";
import { DateRangePicker } from "./date-range-picker";

type SearchInputProps = {
  value: SearchState;
  onChange: (state: SearchState) => void;
  getFilterValues?: (type: FilterType) => Promise<string[]>;
  placeholder?: string;
  className?: string;
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

  // @ must be at start or after a space
  const charBefore = query[lastAtIndex - 1];
  if (lastAtIndex > 0 && charBefore !== " ") {
    return { mode: "none", filterType: null, searchText: "", prefixEnd: 0 };
  }

  const afterAt = query.slice(lastAtIndex + 1);

  // Check if there's a colon (filter type selected)
  const colonIndex = afterAt.indexOf(":");

  if (colonIndex === -1) {
    // No colon yet - user is selecting filter type
    // Check if text after @ contains a space (filter abandoned)
    if (afterAt.includes(" ")) {
      return { mode: "none", filterType: null, searchText: "", prefixEnd: 0 };
    }
    return {
      mode: "types",
      filterType: null,
      searchText: afterAt,
      prefixEnd: lastAtIndex
    };
  }

  // Has colon - check if it's a valid filter type
  const typePart = afterAt.slice(0, colonIndex);
  const valuePart = afterAt.slice(colonIndex + 1);

  // Check if value part has a space (filter abandoned)
  if (valuePart.includes(" ")) {
    return { mode: "none", filterType: null, searchText: "", prefixEnd: 0 };
  }

  if (typePart in FILTER_TYPES) {
    return {
      mode: "values",
      filterType: typePart as FilterType,
      searchText: valuePart,
      prefixEnd: lastAtIndex
    };
  }

  return { mode: "none", filterType: null, searchText: "", prefixEnd: 0 };
}

export function SearchInput({
  value,
  onChange,
  getFilterValues,
  placeholder = "Search",
  className,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Values loaded from API
  const [filterValues, setFilterValues] = useState<string[]>([]);
  const [loadingValues, setLoadingValues] = useState(false);

  // Parse current filter context from query
  const filterContext = parseFilterContext(value.query);

  // Dropdown is open when we're in types mode, or in values mode for non-date filters
  const dropdownOpen = filterContext.mode === "types" ||
    (filterContext.mode === "values" && filterContext.filterType !== "date");

  // Date picker is open when we're in values mode for date filter
  const datePickerOpen = filterContext.mode === "values" && filterContext.filterType === "date";

  // Load filter values when entering values mode (for non-date types)
  useEffect(() => {
    if (filterContext.mode === "values" && filterContext.filterType && filterContext.filterType !== "date" && getFilterValues) {
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

  const handleSelectFilterType = useCallback((type: FilterType) => {
    // Insert @type: into the query (for all types including date)
    const beforeFilter = value.query.slice(0, filterContext.prefixEnd);
    const newQuery = `${beforeFilter}@${type}:`;
    onChange({ ...value, query: newQuery });

    // Keep focus on input
    inputRef.current?.focus();
  }, [value, onChange, filterContext.prefixEnd]);

  const handleSelectFilterValue = useCallback((filterValue: string) => {
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
      filters: [...value.filters, newFilter],
    });

    inputRef.current?.focus();
  }, [value, onChange, filterContext]);

  const handleAddFilter = useCallback((filter: Filter) => {
    // Remove any partial filter text
    const newQuery = value.query.slice(0, filterContext.prefixEnd).trimEnd();

    onChange({
      query: newQuery,
      filters: [...value.filters, filter],
    });

    inputRef.current?.focus();
  }, [value, onChange, filterContext.prefixEnd]);

  const handleRemoveFilter = useCallback((id: string) => {
    onChange({
      ...value,
      filters: value.filters.filter((f) => f.id !== id),
    });
    inputRef.current?.focus();
  }, [value, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace on empty input removes last filter chip
    if (e.key === "Backspace" && value.query === "" && value.filters.length > 0) {
      e.preventDefault();
      const lastFilter = value.filters[value.filters.length - 1];
      handleRemoveFilter(lastFilter.id);
    }
  };

  const handleFilterButtonClick = useCallback(() => {
    // Insert @ at the end of query to trigger filter dropdown
    const newQuery = value.query.trimEnd() + (value.query.endsWith(" ") || !value.query ? "@" : " @");
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

  const handleCloseDatePicker = useCallback((open: boolean) => {
    if (!open) {
      // Remove the @date: from query when closing without selecting
      const newQuery = value.query.slice(0, filterContext.prefixEnd).trimEnd();
      onChange({ ...value, query: newQuery });
    }
  }, [value, onChange, filterContext.prefixEnd]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        if (dropdownOpen) {
          handleCloseDropdown();
        }
      }
    };

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen, handleCloseDropdown]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="flex items-center gap-2">
        {/* Filter chips */}
        <FilterChips
          filters={value.filters}
          onRemove={handleRemoveFilter}
          className="shrink-0"
        />

        {/* Input wrapper */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={value.query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={value.filters.length > 0 ? "" : placeholder}
            aria-label="Search"
            className="w-full rounded-none border-0 border-b bg-transparent px-0 font-serif shadow-none placeholder:italic placeholder:opacity-60 focus-visible:border-input focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent md:text-lg"
          />
        </div>

        {/* Mobile filter button */}
        <Button
          variant="ghost-subtle"
          size="icon"
          className="shrink-0 md:hidden"
          onClick={handleFilterButtonClick}
          aria-label="Add filter"
        >
          <FilterIcon className="size-4" />
        </Button>
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
        onAddFilter={handleAddFilter}
      />
    </div>
  );
}
