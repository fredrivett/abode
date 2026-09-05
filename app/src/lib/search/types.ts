/**
 * Search and filter types for the application.
 *
 * Filter syntax in the search bar:
 * - @type:image - Filter by item kind
 * - @tag:landscape - Filter by tag
 * - @object:tree - Filter by detected object
 * - @color:#FF5733 - Filter by color (hex)
 * - @source:instagram - Filter by source
 * - @date:2024-01-15 - Filter by specific date
 * - @date:>2024-01-15 - Filter after date
 * - @date:<2024-01-15 - Filter before date
 * - @date:2024-01-01..2024-01-31 - Filter date range
 * - @location:paris - Filter by location
 * - -@tag:landscape - Negated filter (exclude)
 */

export type FilterType =
  | "type"
  | "tag"
  | "object"
  | "color"
  | "source"
  | "date"
  | "location"
  | "status";

/** Special filter value for items with no value set */
export const NONE_FILTER_VALUE = "(none)";
/** Special filter value for items with any value set */
export const NOT_NONE_FILTER_VALUE = "!(none)";

export type DateOperator = "is" | "before" | "after" | "between";

export type Filter = {
  id: string;
  type: FilterType;
  value: string;
  negated: boolean;
  // For date filters
  dateOperator?: DateOperator;
  endDate?: string; // For "between" operator
};

export type FilterDropdownMode = "types" | "values" | "calendar";

export type SearchState = {
  query: string;
  filters: Filter[];
};

/** A blank search — no query, no filters. Returns a fresh object each call. */
export function emptySearchState(): SearchState {
  return { query: "", filters: [] };
}

// Filter type metadata for UI
// `multiple` reflects whether items can have multiple values of this type in the schema:
// - Arrays (tags[], objects[]) → multiple: true
// - Single values (kind, source, createdAt) → multiple: false
// For OR queries on single-value fields, use pipe syntax: @source:instagram|camera-roll
export const FILTER_TYPES: Record<
  FilterType,
  {
    label: string;
    placeholder: string;
    icon: string;
    /** Whether multiple filters of this type can be added (based on schema cardinality). */
    multiple: boolean;
    /** Whether items can have no value for this filter type. */
    nullable: boolean;
  }
> = {
  type: {
    label: "Type",
    placeholder: "e.g. image",
    icon: "✳️",
    multiple: false, // ItemKind is a single enum value
    nullable: false, // Items always have a kind
  },
  tag: {
    label: "Tag",
    placeholder: "e.g. landscape",
    icon: "🏷️",
    multiple: true, // tags is String[]
    nullable: true, // tags can be empty array
  },
  object: {
    label: "Object",
    placeholder: "e.g. tree",
    icon: "📦",
    multiple: true, // objects is String[]
    nullable: true, // May not have image details with objects
  },
  color: {
    label: "Color",
    placeholder: "e.g. #FF5733",
    icon: "🎨",
    multiple: true, // colors is Json (can have multiple)
    nullable: true, // May not have color analysis
  },
  source: {
    label: "Source",
    placeholder: "e.g. instagram",
    icon: "🔗",
    multiple: false, // sourceType is a single String
    nullable: true, // source_type can be NULL
  },
  date: {
    label: "Date",
    placeholder: "e.g. 2024-01-15",
    icon: "📅",
    multiple: false, // createdAt is a single DateTime
    nullable: false, // Items always have created_at
  },
  location: {
    label: "Location",
    placeholder: "e.g. paris",
    icon: "📍",
    multiple: true, // ItemLocation is a separate table, items can have multiple
    nullable: true, // May have no associated locations
  },
  status: {
    label: "Status",
    placeholder: "e.g. unread",
    icon: "🔖",
    multiple: false, // one consumption status per item
    nullable: false, // unread is a first-class value, not an absence
  },
};

/**
 * Get the text color class for a filter type.
 * Note: These must be static strings (not template literals) for Tailwind JIT to detect them.
 */
export function getFilterTextColorClass(type: FilterType): string {
  const textColors: Record<FilterType, string> = {
    type: "text-filter-type",
    tag: "text-filter-tag",
    object: "text-filter-object",
    color: "text-filter-color",
    source: "text-filter-source",
    date: "text-filter-date",
    location: "text-filter-location",
    status: "text-filter-status",
  };
  return textColors[type];
}

/**
 * Get all color classes for a filter type chip (background, text, border).
 * Note: These must be static strings (not template literals) for Tailwind JIT to detect them.
 */
export function getFilterColorClass(type: FilterType): string {
  const colorClasses: Record<FilterType, string> = {
    type: "bg-filter-type/15 text-filter-type border-filter-type/30",
    tag: "bg-filter-tag/15 text-filter-tag border-filter-tag/30",
    object: "bg-filter-object/15 text-filter-object border-filter-object/30",
    color: "bg-filter-color/15 text-filter-color border-filter-color/30",
    source: "bg-filter-source/15 text-filter-source border-filter-source/30",
    date: "bg-filter-date/15 text-filter-date border-filter-date/30",
    location:
      "bg-filter-location/15 text-filter-location border-filter-location/30",
    status: "bg-filter-status/15 text-filter-status border-filter-status/30",
  };
  return colorClasses[type];
}

/**
 * Parse a filter string like "@tag:landscape" or "-@date:>2024-01-01"
 */
export function parseFilterString(str: string): Partial<Filter> | null {
  const negated = str.startsWith("-");
  const filterPart = negated ? str.slice(1) : str;

  if (!filterPart.startsWith("@")) return null;

  const colonIndex = filterPart.indexOf(":");
  if (colonIndex === -1) {
    // Just "@tag" without value - return partial for dropdown
    const type = filterPart.slice(1) as FilterType;
    if (type in FILTER_TYPES) {
      return { type, negated };
    }
    return null;
  }

  const type = filterPart.slice(1, colonIndex) as FilterType;
  const value = filterPart.slice(colonIndex + 1);

  if (!(type in FILTER_TYPES)) return null;

  // Parse date operators
  if (type === "date") {
    if (value.startsWith(">")) {
      return {
        type,
        value: value.slice(1),
        negated,
        dateOperator: "after",
      };
    }
    if (value.startsWith("<")) {
      return {
        type,
        value: value.slice(1),
        negated,
        dateOperator: "before",
      };
    }
    if (value.includes("..")) {
      const [start, end] = value.split("..");
      return {
        type,
        value: start,
        endDate: end,
        negated,
        dateOperator: "between",
      };
    }
    return { type, value, negated, dateOperator: "is" };
  }

  return { type, value, negated };
}

/**
 * Serialize a filter to string format for URL/display
 */
export function serializeFilter(filter: Filter): string {
  const prefix = filter.negated ? "-@" : "@";
  const type = filter.type;

  if (filter.type === "date") {
    switch (filter.dateOperator) {
      case "after":
        return `${prefix}${type}:>${filter.value}`;
      case "before":
        return `${prefix}${type}:<${filter.value}`;
      case "between":
        return `${prefix}${type}:${filter.value}..${filter.endDate}`;
      default:
        return `${prefix}${type}:${filter.value}`;
    }
  }

  return `${prefix}${type}:${filter.value}`;
}

/**
 * Create a unique ID for a filter
 */
export function createFilterId(): string {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Parse URL search params into SearchState
 */
export function parseSearchParams(params: URLSearchParams): SearchState {
  const query = params.get("q") || "";
  const filters: Filter[] = [];

  // Parse each filter type from URL
  for (const type of Object.keys(FILTER_TYPES) as FilterType[]) {
    const values = params.getAll(type);
    for (const value of values) {
      const negated = value.startsWith("!");
      const actualValue = negated ? value.slice(1) : value;

      if (type === "date") {
        const parsed = parseFilterString(`@date:${actualValue}`);
        if (parsed) {
          filters.push({
            id: createFilterId(),
            type,
            value: parsed.value || actualValue,
            negated,
            dateOperator: parsed.dateOperator,
            endDate: parsed.endDate,
          });
        }
      } else {
        filters.push({
          id: createFilterId(),
          type,
          value: actualValue,
          negated,
        });
      }
    }
  }

  return { query, filters };
}

/**
 * Serialize SearchState to URL search params
 */
export function serializeSearchParams(state: SearchState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.query) {
    params.set("q", state.query);
  }

  for (const filter of state.filters) {
    let value = filter.value;

    if (filter.type === "date") {
      switch (filter.dateOperator) {
        case "after":
          value = `>${filter.value}`;
          break;
        case "before":
          value = `<${filter.value}`;
          break;
        case "between":
          value = `${filter.value}..${filter.endDate}`;
          break;
      }
    }

    if (filter.negated) {
      value = `!${value}`;
    }

    params.append(filter.type, value);
  }

  return params;
}

/**
 * Check if two filter arrays are equivalent (ignoring IDs and order).
 *
 * Compares filters by their semantic content (type, value, negated, date fields)
 * rather than by reference or ID. Useful for detecting unsaved changes.
 */
export function filtersEqual(a: Filter[], b: Filter[]): boolean {
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
