import { FilterChip } from "@/components/search/filter-chip";
import { Badge } from "@/components/ui/badge";
import type { Filter } from "@/lib/search/types";

type FilterBadgesProps = {
  /** Filters array (directly from room.filters) */
  filters: Filter[];
  /** When true, limits badges shown and uses compact format for lists */
  compact?: boolean;
  /** Additional className for filter chips */
  chipClassName?: string;
};

/**
 * Render filter badges for a room's filters.
 * Use compact mode for room lists, full mode for room detail views.
 */
export function FilterBadges({
  filters,
  compact = false,
  chipClassName,
}: FilterBadgesProps) {
  if (filters.length === 0) return null;

  if (compact) {
    return (
      <CompactFilterBadges filters={filters} chipClassName={chipClassName} />
    );
  }

  return (
    <>
      {filters.map((filter) => (
        <FilterChip key={filter.id} filter={filter} className={chipClassName} />
      ))}
    </>
  );
}

function CompactFilterBadges({
  filters,
  chipClassName = "text-xs",
}: {
  filters: Filter[];
  chipClassName?: string;
}) {
  // Limit to first 3 filters, show "+N more" if there are more
  const maxVisible = 3;

  if (filters.length <= maxVisible) {
    return (
      <>
        {filters.map((filter) => (
          <FilterChip
            key={filter.id}
            filter={filter}
            className={chipClassName}
          />
        ))}
      </>
    );
  }

  const remaining = filters.length - maxVisible;
  return (
    <>
      {filters.slice(0, maxVisible).map((filter) => (
        <FilterChip key={filter.id} filter={filter} className={chipClassName} />
      ))}
      <Badge variant="outline" className={chipClassName}>
        +{remaining} more
      </Badge>
    </>
  );
}
