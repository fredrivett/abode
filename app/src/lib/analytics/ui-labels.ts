/** Collapse whitespace the way rendered text reads, for exact matching */
export function normalizeLabel(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Parse the build-inlined label list; anything malformed means no labels */
export function parseUiLabels(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) &&
      parsed.every((label) => typeof label === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
}

// UI copy written literally in the source, extracted and inlined at build
// time by next.config.ts (`extractUiLabels`)
let uiLabels = new Set(parseUiLabels(process.env.NEXT_PUBLIC_UI_LABELS));

/** True when text is UI copy from the source, not something a user wrote */
export function isUiLabel(text: string): boolean {
  return uiLabels.has(normalizeLabel(text));
}

/** Replace the label list — for tests, which run without a Next build */
export function setUiLabels(labels: readonly string[]): void {
  uiLabels = new Set(labels);
}
