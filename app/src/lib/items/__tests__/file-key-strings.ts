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
