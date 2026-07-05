"use client";

import posthog from "posthog-js";
import { type KeyboardEvent, useCallback, useState } from "react";
import { toast } from "sonner";
import { NoteEditor } from "@/components/note/note-editor";
import { NOTE_PROSE_CLASS } from "@/components/note/note-prose";
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
 * Sized as a 1:1 card matching a note card. Collapsed it's a single prompt;
 * clicking expands into a markdown WYSIWYG editor styled to match the note card
 * preview, so typed text looks exactly as it will once saved. Saving creates a
 * note item synchronously and refreshes the grid.
 */
export function NoteComposer() {
  const invalidateItems = useInvalidateItems();
  const [expanded, setExpanded] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // Remount the editor after a successful save to clear its content
  const [editorKey, setEditorKey] = useState(0);

  const isEmpty = markdown.trim().length === 0;

  const reset = useCallback(() => {
    setMarkdown("");
    setExpanded(false);
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

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="group relative flex h-full w-full cursor-pointer flex-col overflow-hidden border border-border border-dashed bg-card text-left text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
        style={{ ...gridCardStyle, padding: "1.25em" }}
      >
        <span className="italic" style={{ fontSize: "0.875em" }}>
          Take a note…
        </span>
      </button>
    );
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: keyboard shortcuts for the inline composer
    <div
      className="relative flex h-full w-full flex-col overflow-hidden border border-border bg-card"
      style={{ ...gridCardStyle, padding: "1.25em" }}
      onKeyDown={handleKeyDown}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <NoteEditor
          key={editorKey}
          content=""
          autoFocus
          onChange={setMarkdown}
          proseClassName={NOTE_PROSE_CLASS}
        />
      </div>
      <div className="mt-[0.75em] flex shrink-0 items-center justify-end gap-[0.5em]">
        <Button variant="ghost" size="sm" onClick={reset} disabled={isSaving}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isEmpty || isSaving}>
          {isSaving ? <IsLoading label="Saving" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}
