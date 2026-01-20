import { FILTER_TYPES, type FilterType } from "./types";

export type FilterContext = {
  mode: "none" | "types" | "values";
  filterType: FilterType | null;
  searchText: string;
  prefixEnd: number; // position where the @ starts
};

/**
 * Parse the current filter context from a query string.
 * Detects when user is typing a filter (e.g., @tag:landscape) and returns
 * the current mode, filter type, search text, and position of the @ symbol.
 */
export function parseFilterContext(query: string): FilterContext {
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
