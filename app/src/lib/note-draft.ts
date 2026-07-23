/**
 * Client-side persistence for the inline note composer's in-progress draft.
 *
 * The composer POSTs a *completed* note on save; this keeps the unsaved compose
 * text in localStorage so a reload or accidental navigation doesn't lose it. The
 * draft is ephemeral working state, not a server-side draft item — it never
 * appears in the grid and is cleared once the note is saved.
 */

// Single key: the composer is a singleton per page. Note this is not scoped per
// user, so a draft left in one account is visible to another on the same browser
// profile — acceptable for ephemeral compose text.
export const NOTE_DRAFT_STORAGE_KEY = "abode:note-composer-draft";

/**
 * True when the markdown has no real content. The composer's editor always holds
 * a title heading, so an "empty" note serializes to just heading markers and
 * whitespace — strip those before checking.
 */
export function isBlankNote(markdown: string): boolean {
  return markdown.replace(/[#\s]/g, "").length === 0;
}

/** Reads the saved draft, or null when there's none (or storage is unavailable). */
export function readNoteDraft(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const draft = window.localStorage.getItem(NOTE_DRAFT_STORAGE_KEY);
    return draft && !isBlankNote(draft) ? draft : null;
  } catch {
    return null;
  }
}

/** Persists the draft, clearing it instead when the note is blank. */
export function writeNoteDraft(markdown: string): void {
  if (typeof window === "undefined") return;
  try {
    if (isBlankNote(markdown)) {
      window.localStorage.removeItem(NOTE_DRAFT_STORAGE_KEY);
    } else {
      window.localStorage.setItem(NOTE_DRAFT_STORAGE_KEY, markdown);
    }
  } catch {
    // Ignore quota/availability errors — a lost draft is non-critical
  }
}

/** Removes any saved draft (called once the note is saved or cleared). */
export function clearNoteDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(NOTE_DRAFT_STORAGE_KEY);
  } catch {
    // Ignore — nothing to recover if removal fails
  }
}
