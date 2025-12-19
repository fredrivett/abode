import { FilterChip } from "@/components/search/filter-chip";
import { Badge } from "@/components/ui/badge";
import type { RoomFilters } from "@/lib/rooms";
import type { Filter } from "@/lib/search/types";

type FilterBadgesProps = {
  filters: RoomFilters;
  /** When true, limits badges shown and uses compact format for lists */
  compact?: boolean;
  /** Additional className for filter chips */
  chipClassName?: string;
};

/** Filter types that exist on RoomFilters (excludes 'date' which uses dateAfter/dateBefore) */
type RoomFilterType =
  | "type"
  | "tag"
  | "object"
  | "color"
  | "source"
  | "location";

/**
 * Convert RoomFilters to an array of Filter objects for use with FilterChip.
 */
function roomFiltersToSearchFilters(filters: RoomFilters): Filter[] {
  const result: Filter[] = [];
  let id = 0;

  const filterTypes: RoomFilterType[] = [
    "type",
    "tag",
    "object",
    "color",
    "source",
    "location",
  ];

  for (const type of filterTypes) {
    const values = filters[type];
    if (values?.length) {
      for (const f of values) {
        result.push({
          id: `room-filter-${id++}`,
          type,
          value: f.value,
          negated: f.negated,
        });
      }
    }
  }

  // Handle date filters
  if (filters.dateAfter) {
    result.push({
      id: `room-filter-${id++}`,
      type: "date",
      value: filters.dateAfter,
      negated: false,
      dateOperator: "after",
    });
  }

  if (filters.dateBefore) {
    result.push({
      id: `room-filter-${id++}`,
      type: "date",
      value: filters.dateBefore,
      negated: false,
      dateOperator: "before",
    });
  }

  return result;
}

/**
 * Render filter badges for a room's filters.
 * Use compact mode for room lists, full mode for room detail views.
 */
export function FilterBadges({
  filters,
  compact = false,
  chipClassName,
}: FilterBadgesProps) {
  const searchFilters = roomFiltersToSearchFilters(filters);

  if (searchFilters.length === 0) return null;

  if (compact) {
    return (
      <CompactFilterBadges
        filters={searchFilters}
        chipClassName={chipClassName}
      />
    );
  }

  return (
    <>
      {searchFilters.map((filter) => (
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
