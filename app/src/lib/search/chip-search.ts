import { createFilterId, type FilterType, type SearchState } from "./types";

/**
 * A clickable value chip in the item detail dialog (a color swatch, a detected
 * object, or a tag). Clicking it replaces the search with a single filter for
 * that value. `isUserTag` marks user-added tags, whose free text is kept out of
 * analytics; every other chip value is model- or system-derived.
 */
export type ChipSearch = {
  type: FilterType;
  value: string;
  isUserTag?: boolean;
};

/** Search state for a chip click: replace the search with this single filter */
export function chipSearchState({ type, value }: ChipSearch): SearchState {
  return {
    query: "",
    filters: [{ id: createFilterId(), type, value, negated: false }],
  };
}

/**
 * Analytics payload for a chip click. Raw value is omitted for user tags since
 * that free text can be personal; colors and Vision objects/tags are safe.
 */
export function chipSearchAnalytics({
  itemId,
  type,
  value,
  isUserTag = false,
}: ChipSearch & { itemId: string }): Record<string, unknown> {
  return {
    // snake_case to match the other item_* PostHog events
    item_id: itemId,
    facet: isUserTag ? "userTag" : type,
    ...(isUserTag ? {} : { value }),
  };
}
