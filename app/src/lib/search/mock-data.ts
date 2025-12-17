/**
 * Filter values loader for autocomplete.
 *
 * This module was previously mock data, now it fetches from the real API.
 * Kept as a separate module to maintain backward compatibility with existing imports.
 */

import { getFilterValuesForType } from "./api";
import type { FilterType } from "./types";

/**
 * Get filter values for a given filter type.
 *
 * @param type - The filter type to get values for
 * @returns Array of values for autocomplete
 */
export async function getMockFilterValues(type: FilterType): Promise<string[]> {
  // Date filter uses calendar picker, not value list
  if (type === "date") {
    return [];
  }

  try {
    return await getFilterValuesForType(type);
  } catch (_error) {
    return [];
  }
}
