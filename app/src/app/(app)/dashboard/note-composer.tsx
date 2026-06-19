"use client";

import posthog from "posthog-js";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { NoteEditor } from "@/components/note/note-editor";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import { api } from "@/lib/api-client";
import { useInvalidateItems } from "@/lib/api-hooks";
import { createLogger } from "@/lib/logger.client";
import { markdownToPlainText } from "@/lib/markdown";

const log = createLogger("dashboard/note-composer");

/**
 * Inline note composer for the dashboard (mymind-style "take a note" box).
 *
 * Collapsed it's a single prompt; focusing expands into a markdown WYSIWYG
 * editor. Saving creates a note item synchronously and refreshes the grid.
 */
export function NoteComposer() {
  const invalidateItems = useInvalidateItems();
  const [expanded, setExpanded] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // Remount the editor after a successful save to clear its content
  const [editorKey, setEditorKey] = useState(0);

  const isEmpty = markdownToPlainText(markdown).length === 0;

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

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full rounded-lg border border-border border-dashed bg-background px-4 py-3 text-left text-muted-foreground text-sm transition-colors hover:border-muted-foreground/40 hover:bg-muted/30"
      >
        Take a note…
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background p-4 shadow-sm">
      <NoteEditor
        key={editorKey}
        content=""
        autoFocus
        onChange={setMarkdown}
        className="min-h-[4rem]"
      />
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={reset} disabled={isSaving}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isEmpty || isSaving}>
          {isSaving ? <IsLoading label="Saving" /> : "Save note"}
        </Button>
      </div>
    </div>
  );
}
