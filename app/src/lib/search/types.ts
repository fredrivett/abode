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
 * - -@tag:landscape - Negated filter (exclude)
 */

export type FilterType = "type" | "tag" | "object" | "color" | "source" | "date";

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

// Filter type metadata for UI
export const FILTER_TYPES: Record<
  FilterType,
  { label: string; placeholder: string; icon: string }
> = {
  type: { label: "Type", placeholder: "e.g. image", icon: "🖼️" },
  tag: { label: "Tag", placeholder: "e.g. landscape", icon: "🏷️" },
  object: { label: "Object", placeholder: "e.g. tree", icon: "📦" },
  color: { label: "Color", placeholder: "e.g. #FF5733", icon: "🎨" },
  source: { label: "Source", placeholder: "e.g. instagram", icon: "🔗" },
  date: { label: "Date", placeholder: "e.g. 2024-01-15", icon: "📅" },
};

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
