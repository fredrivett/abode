"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IsLoading } from "@/components/ui/is-loading";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  FILTER_TYPES,
  type FilterType,
  NONE_FILTER_VALUE,
  NOT_NONE_FILTER_VALUE,
} from "@/lib/search/types";
import { cn } from "@/lib/utils";

type FilterDropdownProps = {
  open: boolean;
  onClose: () => void;
  mode: "types" | "values";
  currentFilterType: FilterType | null;
  searchText: string;
  filterValues: string[];
  loadingValues: boolean;
  onSelectType: (type: FilterType) => void;
  onSelectValue: (value: string) => void;
  anchorRef: React.RefObject<HTMLInputElement | null>;
};

export function FilterDropdown({
  open,
  onClose,
  mode,
  currentFilterType,
  searchText,
  filterValues,
  loadingValues,
  onSelectType,
  onSelectValue,
  anchorRef,
}: FilterDropdownProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter types based on search text
  const filteredTypes = useMemo(() => {
    const types = Object.entries(FILTER_TYPES) as [
      FilterType,
      (typeof FILTER_TYPES)[FilterType],
    ][];
    if (!searchText) return types;
    return types.filter(
      ([type, meta]) =>
        type.toLowerCase().startsWith(searchText.toLowerCase()) ||
        meta.label.toLowerCase().startsWith(searchText.toLowerCase()),
    );
  }, [searchText]);

  // Filter values based on search text, prepending (none)/!(none) for nullable types
  const filteredValues = useMemo(() => {
    // Prepend null options for nullable filter types
    let values = filterValues;
    if (currentFilterType && FILTER_TYPES[currentFilterType].nullable) {
      values = [NONE_FILTER_VALUE, NOT_NONE_FILTER_VALUE, ...filterValues];
    }

    if (!searchText) return values;
    return values.filter((v) =>
      v.toLowerCase().includes(searchText.toLowerCase()),
    );
  }, [filterValues, searchText, currentFilterType]);

  const itemCount =
    mode === "types" ? filteredTypes.length : filteredValues.length;

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector(
      `[data-index="${selectedIndex}"]`,
    );
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Keyboard navigation - use capture phase to intercept before cmdk
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => Math.min(prev + 1, itemCount - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          e.stopPropagation();
          if (mode === "types" && filteredTypes[selectedIndex]) {
            onSelectType(filteredTypes[selectedIndex][0]);
          } else if (mode === "values") {
            if (filteredValues[selectedIndex]) {
              onSelectValue(filteredValues[selectedIndex]);
            } else if (searchText) {
              // Allow entering custom value
              onSelectValue(searchText);
            }
          }
          break;
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
        case "Tab":
          // Select the highlighted value (like Enter) before moving focus
          e.preventDefault();
          e.stopPropagation();
          if (mode === "types" && filteredTypes[selectedIndex]) {
            onSelectType(filteredTypes[selectedIndex][0]);
          } else if (mode === "values") {
            if (filteredValues[selectedIndex]) {
              onSelectValue(filteredValues[selectedIndex]);
            } else if (searchText) {
              onSelectValue(searchText);
            }
          }
          break;
      }
    };

    // Use capture phase to intercept events before they reach cmdk
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [
    open,
    mode,
    selectedIndex,
    itemCount,
    filteredTypes,
    filteredValues,
    searchText,
    onSelectType,
    onSelectValue,
    onClose,
  ]);

  // Create a non-null ref wrapper for Radix
  const virtualRef = {
    current: anchorRef.current,
  } as React.RefObject<HTMLInputElement>;

  if (!open) return null;

  return (
    <Popover open={open} onOpenChange={(o) => !o && onClose()}>
      <PopoverAnchor virtualRef={anchorRef.current ? virtualRef : undefined} />
      <PopoverContent
        className="w-64 p-1"
        align="start"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={() => {
          // Prevent closing when clicking inside the popover
          // The onClose will be handled by our click handlers
        }}
        onInteractOutside={(e) => {
          // Let the search-input's click-outside handler manage this
          e.preventDefault();
        }}
      >
        <div ref={listRef} className="max-h-64 overflow-y-auto">
          {mode === "types" &&
            (filteredTypes.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No filter types match "{searchText}"
              </div>
            ) : (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Filter by
                </div>
                {filteredTypes.map(([type, meta], index) => (
                  <button
                    type="button"
                    key={type}
                    data-index={index}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelectType(type);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                      index === selectedIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      @{type}:
                    </span>
                  </button>
                ))}
              </>
            ))}

          {mode === "values" &&
            currentFilterType &&
            (loadingValues ? (
              <div className="flex justify-center px-2 py-4 text-sm text-muted-foreground">
                <IsLoading label="Loading" />
              </div>
            ) : filteredValues.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                {searchText
                  ? `Press Enter to add "${searchText}"`
                  : "Type a value or select from list"}
              </div>
            ) : (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {FILTER_TYPES[currentFilterType].label}
                </div>
                {filteredValues.map((value, index) => (
                  <button
                    type="button"
                    key={value}
                    data-index={index}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelectValue(value);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                      index === selectedIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    {currentFilterType === "color" ? (
                      <>
                        <div
                          className="size-4 rounded-full border"
                          style={{ backgroundColor: value }}
                        />
                        <span>{value}</span>
                      </>
                    ) : (
                      <span
                        className={cn(
                          (value === NONE_FILTER_VALUE ||
                            value === NOT_NONE_FILTER_VALUE) &&
                            "italic",
                        )}
                      >
                        {value}
                      </span>
                    )}
                  </button>
                ))}
              </>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
