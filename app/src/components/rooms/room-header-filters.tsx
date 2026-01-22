"use client";

import { Check, Loader2, Pencil, X } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { SearchInput } from "@/components/search/search-input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type Filter,
  filtersEqual,
  type SearchState,
} from "@/lib/search/types";
import { useFilterOptions } from "@/lib/search/use-filter-options";

type RoomHeaderFiltersProps = {
  /** Current room filters */
  filters: Filter[];
  /** Called when filters are saved */
  onSave: (filters: Filter[]) => Promise<void>;
  /** Called after successful save to refresh items */
  onFiltersChanged?: () => void;
  /** Whether the current user can edit filters */
  canEdit?: boolean;
};

export function RoomHeaderFilters({
  filters,
  onSave,
  onFiltersChanged,
  canEdit = true,
}: RoomHeaderFiltersProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchState, setSearchState] = useState<SearchState>({
    query: "",
    filters: filters,
  });

  const { getFilterValuesForType } = useFilterOptions();

  // Check if there are unsaved changes
  const hasChanges = !filtersEqual(filters, searchState.filters);

  // Check if current filters are valid for saving (at least one filter)
  const canSave = searchState.filters.length > 0;

  const handleEditClick = useCallback(() => {
    // Reset to current saved filters when starting to edit
    setSearchState({ query: "", filters: filters });
    setIsEditing(true);
  }, [filters]);

  const handleCancel = useCallback(() => {
    // Reset to saved filters
    setSearchState({ query: "", filters: filters });
    setIsEditing(false);
  }, [filters]);

  const handleSave = useCallback(async () => {
    if (searchState.filters.length === 0) {
      toast.error("At least one filter is required");
      return;
    }

    setIsSaving(true);
    try {
      await onSave(searchState.filters);
      setIsEditing(false);
      toast.success("Filters saved");
      onFiltersChanged?.();
    } catch {
      toast.error("Failed to save filters");
    } finally {
      setIsSaving(false);
    }
  }, [searchState.filters, onSave, onFiltersChanged]);

  // View-only mode (visitor or not editing)
  if (!canEdit || !isEditing) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <SearchInput
            value={{ query: "", filters: filters }}
            onChange={() => {}}
            getFilterValues={getFilterValuesForType}
            placeholder="Filters"
            disabled
          />
        </div>
        {canEdit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost-subtle"
                size="icon"
                onClick={handleEditClick}
                aria-label="Edit filters"
                className="shrink-0"
              >
                <Pencil className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              edit filters
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <SearchInput
          value={searchState}
          onChange={setSearchState}
          getFilterValues={getFilterValuesForType}
          placeholder="Add filters..."
        />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost-subtle"
              size="icon"
              onClick={handleCancel}
              disabled={isSaving}
              aria-label="Cancel"
            >
              <X className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            cancel
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost-subtle"
              size="icon"
              onClick={handleSave}
              disabled={isSaving || !canSave || !hasChanges}
              aria-label="Save filters"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            save
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
