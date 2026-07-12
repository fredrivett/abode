"use client";

import posthog from "posthog-js";
import { type KeyboardEvent, useCallback, useState } from "react";
import { toast } from "sonner";
import { NoteEditor } from "@/components/note/note-editor";
import { NOTE_PROSE_FONT_SIZE } from "@/components/note/note-prose";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import { api } from "@/lib/api-client";
import { useInvalidateItems } from "@/lib/api-hooks";
import { gridCardStyle } from "@/lib/grid-styles";
import { createLogger } from "@/lib/logger.client";

const log = createLogger("dashboard/note-composer");

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
  const [isSaving, setIsSaving] = useState(false);
  // Remount the editor to clear its content after a save or clear
  const [editorKey, setEditorKey] = useState(0);

  // The editor always holds a title heading, so an "empty" note serializes to
  // just heading markers/whitespace — strip those before checking.
  const isEmpty = markdown.replace(/[#\s]/g, "").length === 0;

  const reset = useCallback(() => {
    setMarkdown("");
    setEditorKey((k) => k + 1);
  }, []);

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
        <NoteEditor
          key={editorKey}
          content=""
          onChange={setMarkdown}
          className="min-h-full"
          titleFirst
        />
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
