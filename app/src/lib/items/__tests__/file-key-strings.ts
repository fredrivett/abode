const FILE_KEY_PROPERTY = /filekey$/i;

/**
 * Every non-empty string held under a `…fileKey`-named property (`fileKey`,
 * `coverFileKey`, `imageFileKey`, …), however deeply nested in rows or JSON.
 * Tests compare this against what the collectors return, so a key location the
 * collectors miss shows up without the test having to list locations itself.
 */
export function fileKeyStrings(value: unknown): Set<string> {
  const found = new Set<string>();
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const entry of node) walk(entry);
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node)) {
      if (FILE_KEY_PROPERTY.test(key) && typeof child === "string" && child) {
        found.add(child);
      } else {
        walk(child);
      }
    }
  };
  walk(value);
  return found;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Paths in a Prisma `select` that `row` leaves empty (null, "", or an empty
 * array/relation list). A fixture meant to exercise every file-key location
 * asserts this is empty, so a location added to the select but not populated
 * in the fixture fails by name instead of silently dropping out of the test.
 */
export function unpopulatedSelections(
  select: Record<string, unknown>,
  row: unknown,
  path = "",
): string[] {
  if (!isRecord(row)) return [path || "(row)"];
  return Object.entries(select).flatMap(([field, selection]) => {
    const at = path ? `${path}.${field}` : field;
    const value = row[field];
    const empty =
      value === null ||
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);
    if (empty) return [at];
    if (!isRecord(selection) || !isRecord(selection.select)) return [];
    const nested = selection.select;
    return Array.isArray(value)
      ? value.flatMap((entry, i) =>
          unpopulatedSelections(nested, entry, `${at}[${i}]`),
        )
      : unpopulatedSelections(nested, value, at);
  });
}
