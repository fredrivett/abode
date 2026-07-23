"use client";

import posthog from "posthog-js";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { NoteEditor } from "@/components/note/note-editor";
import { NOTE_PROSE_FONT_SIZE } from "@/components/note/note-prose";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import { useConfirmAction } from "@/hooks/use-confirm-action";
import { api } from "@/lib/api-client";
import { useInvalidateItems } from "@/lib/api-hooks";
import { gridCardStyle } from "@/lib/grid-styles";
import { isBlankNote } from "@/lib/items/note-title";
import { createLogger } from "@/lib/logger.client";

const log = createLogger("dashboard/note-composer");

// Delay before an edit is persisted to the server draft
const DRAFT_SAVE_DEBOUNCE_MS = 1000;
const DRAFT_ENDPOINT = "/api/v1/note-draft";

type NoteComposerProps = {
  /** Server-rendered draft to repopulate the composer with on load */
  initialDraft?: string | null;
};

/**
 * Inline note composer — the first card in the grid (mymind-style "take a note").
 *
 * Sized as a 1:1 card matching a note card. Always editable: a placeholder shows
 * when empty, and Save/Clear appear once there's content. The editor is styled to
 * match the note card preview, so typed text looks exactly as it will once saved.
 * Saving creates a note item synchronously and refreshes the grid.
 *
 * In-progress text is auto-saved to a server-side draft (debounced), so it
 * survives reloads and follows the user across devices. The draft is rendered in
 * from the server (no fetch on load) and cleared server-side when the note is
 * saved.
 */
export function NoteComposer({ initialDraft }: NoteComposerProps) {
  const invalidateItems = useInvalidateItems();
  const initialContent = initialDraft ?? "";
  const [markdown, setMarkdown] = useState(initialContent);
  // The content the editor mounts with — the initial draft, reset to "" on
  // save/clear. Editing doesn't change it, so the editor isn't re-synced mid-type.
  const [editorContent, setEditorContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  // Remount the editor to clear its content after a save or clear
  const [editorKey, setEditorKey] = useState(0);

  // Latest content and the last value known to be persisted, so we can dedupe
  // writes and flush the current text on page hide without re-subscribing.
  const contentRef = useRef(initialContent);
  const savedContentRef = useRef(initialContent);
  const dirtyRef = useRef(false);

  const isEmpty = isBlankNote(markdown);

  const persistDraft = useDebouncedCallback(async (value: string) => {
    try {
      await api.post(DRAFT_ENDPOINT, { content: value });
      savedContentRef.current = value;
      dirtyRef.current = false;
    } catch (error) {
      // Keep it dirty — a later edit or the page-hide flush will retry
      log.error({ error }, "Note draft save error");
    }
  }, DRAFT_SAVE_DEBOUNCE_MS);

  // Flush a pending draft write on unmount (e.g. client-side navigation away)
  useEffect(
    () => () => {
      persistDraft.flush();
    },
    [persistDraft],
  );

  // Best-effort flush of the sub-debounce tail on tab hide / unload. `sendBeacon`
  // survives unload (a normal fetch would be cancelled); gated on `dirty` so a
  // clean composer sends nothing.
  useEffect(() => {
    const beaconIfDirty = () => {
      if (!dirtyRef.current) return;
      const body = new Blob([JSON.stringify({ content: contentRef.current })], {
        type: "application/json",
      });
      navigator.sendBeacon(DRAFT_ENDPOINT, body);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") beaconIfDirty();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", beaconIfDirty);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", beaconIfDirty);
    };
  }, []);

  // Return the composer to its empty state and drop any pending draft write.
  const resetComposer = useCallback(() => {
    persistDraft.cancel();
    contentRef.current = "";
    savedContentRef.current = "";
    dirtyRef.current = false;
    setMarkdown("");
    setEditorContent("");
    setEditorKey((k) => k + 1);
  }, [persistDraft]);

  const handleClear = useCallback(() => {
    // Only hit the server if a draft was actually persisted
    if (!isBlankNote(savedContentRef.current)) {
      void api
        .delete(DRAFT_ENDPOINT)
        .catch((error) => log.error({ error }, "Note draft clear error"));
    }
    resetComposer();
  }, [resetComposer]);

  // Two-step confirm so an accidental click can't discard the draft: first
  // click arms the button ("Confirm clear?"), the second clears.
  const clearConfirm = useConfirmAction({
    onConfirm: handleClear,
    revertDelayMs: 2000,
  });

  const handleChange = useCallback(
    (value: string) => {
      // Any editing disarms a pending "Confirm clear"
      clearConfirm.reset();
      setMarkdown(value);
      contentRef.current = value;
      if (value === savedContentRef.current) {
        // Back to the persisted state — or a spurious blank emit from the
        // editor's heading normalisation on mount/reset. Nothing to save.
        persistDraft.cancel();
        dirtyRef.current = false;
        return;
      }
      dirtyRef.current = true;
      persistDraft(value);
    },
    [persistDraft, clearConfirm.reset],
  );

  const handleSave = useCallback(async () => {
    if (isEmpty || isSaving) return;
    setIsSaving(true);
    try {
      // Creating the note clears its server draft in the same request
      await api.post("/api/v1/items/notes", { content: markdown });
      posthog.capture("note_created", { source: "composer" });
      invalidateItems();
      resetComposer();
      clearConfirm.reset();
      toast.success("Note saved");
    } catch (error) {
      log.error({ error }, "Note create error");
      toast.error("Failed to save note");
    } finally {
      setIsSaving(false);
    }
  }, [
    isEmpty,
    isSaving,
    markdown,
    invalidateItems,
    resetComposer,
    clearConfirm.reset,
  ]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        clearConfirm.onClick();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void handleSave();
      }
    },
    [clearConfirm.onClick, handleSave],
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
          content={editorContent}
          onChange={handleChange}
          className="min-h-full"
          titleFirst
        />
      </div>
      {!isEmpty && (
        <div className="mt-[0.75em] flex shrink-0 items-center justify-end gap-[0.5em]">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearConfirm.onClick}
            {...clearConfirm.hoverProps}
            disabled={isSaving}
            className={
              clearConfirm.confirming
                ? "text-destructive hover:text-destructive"
                : undefined
            }
          >
            {clearConfirm.confirming ? "Confirm clear?" : "Clear"}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <IsLoading label="Saving" /> : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}
