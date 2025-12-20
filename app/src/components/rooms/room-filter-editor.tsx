"use client";

import { BalancedMasonryGrid, Frame } from "@masonry-grid/react";
import { Loader2, Pencil, SearchX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SearchInput } from "@/components/search/search-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import { useFilterPreview } from "@/lib/rooms/use-filter-preview";
import type { SearchResultItem } from "@/lib/search/api";
import type { Filter, SearchState } from "@/lib/search/types";
import { useFilterOptions } from "@/lib/search/use-filter-options";
import { ItemCard } from "../../app/(app)/dashboard/item-card";
import type { DashboardItem } from "../../app/(app)/dashboard/items-grid";

type RoomFilterEditorProps = {
  /** Current room filters (Filter[] stored directly) */
  filters: Filter[];
  /** Called when filters are saved */
  onSave: (filters: Filter[]) => Promise<void>;
  /** Whether to start in edit mode (for room creation) */
  initialEditMode?: boolean;
  /** Placeholder text for the search input */
  placeholder?: string;
};

/** Maximum number of items to show in the preview grid */
const PREVIEW_LIMIT = 12;

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${
    units[exponent]
  }`;
}

/**
 * Check if two filter arrays are equivalent (ignoring IDs).
 */
function filtersEqual(a: Filter[], b: Filter[]): boolean {
  if (a.length !== b.length) return false;

  const normalize = (filters: Filter[]) =>
    filters
      .map((f) => ({
        type: f.type,
        value: f.value,
        negated: f.negated,
        dateOperator: f.dateOperator,
        endDate: f.endDate,
      }))
      .sort((x, y) => {
        if (x.type !== y.type) return x.type.localeCompare(y.type);
        return x.value.localeCompare(y.value);
      });

  const normA = normalize(a);
  const normB = normalize(b);

  return JSON.stringify(normA) === JSON.stringify(normB);
}

export function RoomFilterEditor({
  filters,
  onSave,
  initialEditMode = false,
  placeholder = "Filters",
}: RoomFilterEditorProps) {
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Use filters directly (no conversion needed)
  const [searchState, setSearchState] = useState<SearchState>({
    query: "",
    filters: filters,
  });

  // Reset search state when filters prop changes (e.g., after save)
  useEffect(() => {
    setSearchState({ query: "", filters: filters });
  }, [filters]);

  // Get filter options for autocomplete
  const { getFilterValuesForType } = useFilterOptions();

  // Preview results while editing
  const preview = useFilterPreview(searchState.filters, isEditing);

  // Check if there are unsaved changes
  const hasChanges = !filtersEqual(filters, searchState.filters);

  // Check if current filters are valid for saving (at least one filter)
  const canSave = searchState.filters.length > 0;

  const handleEditClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleCancelClick = useCallback(() => {
    if (hasChanges) {
      setShowDiscardDialog(true);
    } else {
      setIsEditing(false);
    }
  }, [hasChanges]);

  const handleDiscardChanges = useCallback(() => {
    setSearchState({ query: "", filters: filters });
    setIsEditing(false);
    setShowDiscardDialog(false);
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
    } catch {
      toast.error("Failed to save filters");
    } finally {
      setIsSaving(false);
    }
  }, [searchState.filters, onSave]);

  return (
    <div className="space-y-4">
      {/* Filter input row */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <SearchInput
            value={searchState}
            onChange={setSearchState}
            getFilterValues={getFilterValuesForType}
            placeholder={placeholder}
            disabled={!isEditing}
          />
        </div>

        {/* Edit button (shown when not editing) */}
        {!isEditing && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleEditClick}
            aria-label="Edit filters"
            className="shrink-0"
          >
            <Pencil className="size-4" />
          </Button>
        )}
      </div>

      {/* Edit mode actions and preview */}
      {isEditing && (
        <>
          {/* Preview section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {preview.isLoading ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" />
                    Loading preview...
                  </span>
                ) : preview.total > 0 ? (
                  `${preview.total} ${preview.total === 1 ? "item" : "items"} match${preview.total === 1 ? "es" : ""}`
                ) : searchState.filters.length === 0 ? (
                  "Add filters to preview matching items"
                ) : (
                  "No items match these filters"
                )}
              </span>
            </div>

            {/* Preview grid */}
            {preview.items.length > 0 && (
              <div className="rounded-lg border bg-muted/20 p-4">
                <BalancedMasonryGrid
                  frameWidth={180}
                  gap={12}
                  style={{ overflow: "visible !important" }}
                >
                  {preview.items.slice(0, PREVIEW_LIMIT).map((item) => (
                    <PreviewItem key={item.id} item={item} />
                  ))}
                </BalancedMasonryGrid>
                {preview.total > PREVIEW_LIMIT && (
                  <p className="mt-3 text-center text-sm text-muted-foreground">
                    +{preview.total - PREVIEW_LIMIT} more items
                  </p>
                )}
              </div>
            )}

            {/* Empty state */}
            {!preview.isLoading &&
              preview.items.length === 0 &&
              searchState.filters.length > 0 && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 py-8 text-center">
                  <SearchX className="size-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No items match these filters
                  </p>
                </div>
              )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleCancelClick}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !canSave}>
              {isSaving ? <IsLoading label="Saving" /> : "Save filters"}
            </Button>
          </div>
        </>
      )}

      {/* Discard changes dialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved filter changes. Are you sure you want to discard
              them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardChanges}>
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Adapt SearchResultItem to DashboardItem for use with ItemCard.
 *
 * These types are structurally compatible for rendering - both have the same
 * fields with compatible shapes. The difference is that DashboardItem uses
 * Prisma enums (ItemKind, ProcessingStatus, SourceType) while SearchResultItem
 * uses their string representations. At runtime, Prisma enums ARE strings,
 * so the values are identical.
 *
 * The only structural differences are:
 * - SearchResultItem has `match` (search metadata) - not used by ItemCard
 * - DashboardItem has `excludeFromPublicRooms` - optional, not used by ItemCard
 * - colors array shape differs slightly but both work with ColorsBar
 */
function toDashboardItem(item: SearchResultItem): DashboardItem {
  // At runtime, this is safe because Prisma enums serialize to their string values.
  // TypeScript requires the cast because the nominal types differ.
  return item as unknown as DashboardItem;
}

/**
 * Preview item card - simplified version for filter preview.
 */
function PreviewItem({ item }: { item: SearchResultItem }) {
  const meta = item.meta || {};
  const isArticle = item.kind === "article";
  const name = item.title ?? "Untitled";
  const size = formatBytes(meta.size as number | undefined);
  const mimeType = meta.type as string | undefined;

  const width = isArticle ? 16 : ((meta.width as number | undefined) ?? 3);
  const height = isArticle ? 9 : ((meta.height as number | undefined) ?? 4);

  return (
    <Frame width={width} height={height}>
      <ItemCard
        item={toDashboardItem(item)}
        name={name}
        size={size}
        mimeType={mimeType}
      />
    </Frame>
  );
}
