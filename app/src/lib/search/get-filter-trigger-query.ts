/**
 * Computes the new query when the filter button is clicked.
 * Returns the new query string, or null if no change is needed (dropdown already open).
 */
export function getFilterTriggerQuery(currentQuery: string): string | null {
  let query = currentQuery.trimEnd();

  // If query ends with a standalone @ (at start or after space), check for cleanup
  if (query === "@" || query.endsWith(" @")) {
    // If there were trailing spaces after the @, the dropdown closed
    // Clean up by removing the @ and re-triggering
    const hadTrailingSpaces = currentQuery.length > query.length;
    if (hadTrailingSpaces) {
      query = query === "@" ? "" : query.slice(0, -2).trimEnd();
    } else {
      // Dropdown is still open, just focus
      return null;
    }
  }

  // Insert @ at the end of query to trigger filter dropdown
  return query + (query === "" || query.endsWith(" ") ? "@" : " @");
}
