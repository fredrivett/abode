"use client";

import posthog from "posthog-js";
import { type KeyboardEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { NoteEditor } from "@/components/note/note-editor";
import { NOTE_PROSE_FONT_SIZE } from "@/components/note/note-prose";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import { api } from "@/lib/api-client";
import { useInvalidateItems } from "@/lib/api-hooks";
import { gridCardStyle } from "@/lib/grid-styles";
import { createLogger } from "@/lib/logger.client";
import {
  clearNoteDraft,
  isBlankNote,
  readNoteDraft,
  writeNoteDraft,
} from "@/lib/note-draft";

const log = createLogger("dashboard/note-composer");

// Delay before an edit is written to the draft store
const DRAFT_SAVE_DEBOUNCE_MS = 1000;

/**
 * Inline note composer — the first card in the grid (mymind-style "take a note").
 *
 * Sized as a 1:1 card matching a note card. Always editable: a placeholder shows
 * when empty, and Save/Clear appear once there's content. The editor is styled to
 * match the note card preview, so typed text looks exactly as it will once saved.
 * Saving creates a note item synchronously and refreshes the grid.
 */
export function NoteComposer() {
  const invalidateItems = useInvalidateItems();
  const [markdown, setMarkdown] = useState("");
  // The content the editor mounts with — starts empty, hydrated from any saved
  // draft after mount and reset to "" on save/clear (see `reset`)
  const [editorContent, setEditorContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // Remount the editor to clear its content after a save or clear
  const [editorKey, setEditorKey] = useState(0);
  // True while an edit is waiting to be flushed to the draft store — used to gate
  // the beforeunload guard so we only warn when something is genuinely unsaved
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // Hold the editor's first render until the saved draft (if any) is read, so it
  // mounts once with the draft as its initial content. Otherwise it would mount
  // empty — and the required-heading normalisation fires an empty `onChange` that
  // races the draft, clobbering `markdown` back to empty.
  const [hydrated, setHydrated] = useState(false);

  const isEmpty = isBlankNote(markdown);

  const saveDraft = useDebouncedCallback((value: string) => {
    writeNoteDraft(value);
    setHasUnsavedChanges(false);
  }, DRAFT_SAVE_DEBOUNCE_MS);

  // Repopulate the composer from a saved draft on load. Runs after mount (not in
  // a state initializer) to avoid touching localStorage during SSR/hydration.
  useEffect(() => {
    const draft = readNoteDraft();
    if (draft) {
      setMarkdown(draft);
      setEditorContent(draft);
    }
    setHydrated(true);
  }, []);

  // Flush any pending draft write on unmount so nothing is lost on navigation
  useEffect(() => () => saveDraft.flush(), [saveDraft]);

  // Warn before leaving while a draft write is still pending, and flush it
  // synchronously so the draft survives even if the user leaves anyway.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      saveDraft.flush();
      e.preventDefault();
      // Legacy signal some browsers still require to show the leave prompt
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges, saveDraft]);

  const handleChange = useCallback(
    (value: string) => {
      setMarkdown(value);
      if (isBlankNote(value)) {
        // The editor can emit a blank update on mount/reset (heading
        // normalisation) or when the user clears the text — that's nothing to
        // save, so drop any pending write and disarm the unsaved-changes guard.
        saveDraft.cancel();
        setHasUnsavedChanges(false);
        clearNoteDraft();
        return;
      }
      setHasUnsavedChanges(true);
      saveDraft(value);
    },
    [saveDraft],
  );

  const reset = useCallback(() => {
    saveDraft.cancel();
    clearNoteDraft();
    setHasUnsavedChanges(false);
    setMarkdown("");
    setEditorContent("");
    setEditorKey((k) => k + 1);
  }, [saveDraft]);

  const handleSave = useCallback(async () => {
    if (isEmpty || isSaving) return;
    setIsSaving(true);
    try {
      await api.post("/api/v1/items/notes", { content: markdown });
      posthog.capture("note_created", { source: "composer" });
      invalidateItems();
      reset();
      toast.success("Note saved");
    } catch (error) {
      log.error({ error }, "Note create error");
      toast.error("Failed to save note");
    } finally {
      setIsSaving(false);
    }
  }, [isEmpty, isSaving, markdown, invalidateItems, reset]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        reset();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void handleSave();
      }
    },
    [reset, handleSave],
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: keyboard shortcuts for the inline composer
    <div
      className="relative flex h-full w-full flex-col overflow-hidden border border-border border-dashed bg-card"
      style={{ ...gridCardStyle, padding: "1.25em" }}
      onKeyDown={handleKeyDown}
    >
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {isEmpty && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 font-semibold font-serif text-muted-foreground/70 leading-[1.2]"
            style={{ fontSize: `calc(1.3 * ${NOTE_PROSE_FONT_SIZE})` }}
          >
            Take a note…
          </span>
        )}
        {hydrated && (
          <NoteEditor
            key={editorKey}
            content={editorContent}
            onChange={handleChange}
            className="min-h-full"
            titleFirst
          />
        )}
      </div>
      {!isEmpty && (
        <div className="mt-[0.75em] flex shrink-0 items-center justify-end gap-[0.5em]">
          <Button variant="ghost" size="sm" onClick={reset} disabled={isSaving}>
            Clear
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <IsLoading label="Saving" /> : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}
