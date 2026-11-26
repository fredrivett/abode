"use client";

import { useQueryClient } from "@tanstack/react-query";
import posthog from "posthog-js";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { useConfirmAction } from "@/hooks/use-confirm-action";
import { api } from "@/lib/api-client";
import { useRevealCreatedItem } from "@/lib/api-hooks";
import { isBlankNote } from "@/lib/items/note-title";
import { itemQueryKey } from "@/lib/items/use-item";
import { viewSavedItemAction } from "@/lib/items/view-saved-item";
import { createLogger } from "@/lib/logger.client";
import type { Item } from "@/lib/types/item";
import { useMilestoneStore } from "@/stores/milestone-store";
import { useItemDialog } from "./item-dialog-context";

const log = createLogger("dashboard/note-draft");

// Delay before an edit is persisted to the server draft
const DRAFT_SAVE_DEBOUNCE_MS = 1000;
// How long a save waits for draft writes already sent, so a stalled one can't block it
const DRAFT_WRITE_WAIT_MS = 3000;
const DRAFT_ENDPOINT = "/api/v1/note-draft";

type NoteDraft = {
  /** The draft's latest markdown */
  markdown: string;
  isEmpty: boolean;
  isSaving: boolean;
  /** What the card's editor mounts with; editing doesn't change it */
  editorContent: string;
  /** Bumped to remount an editor with {@link editorContent} (clear, save, collapse) */
  editorKey: number;
  onChange: (markdown: string) => void;
  /** Create the note; from the dialog it then becomes the saved note's dialog */
  save: (from: "card" | "dialog") => Promise<void>;
  /** Two-step Clear ("Confirm clear?"), shared by the card and the dialog */
  clearConfirm: ReturnType<typeof useConfirmAction>;
};

const NoteDraftContext = createContext<NoteDraft | null>(null);

/** The note composer's draft; null outside {@link NoteDraftProvider}. */
export function useNoteDraft(): NoteDraft | null {
  return useContext(NoteDraftContext);
}

/**
 * Owns the note composer's draft, shared by the grid's composer card and the
 * item dialog's draft mode (`?item=new`), so expanding the card and saving
 * from the dialog edit the same text.
 *
 * In-progress text is auto-saved to a server-side draft (debounced), so it
 * survives reloads and follows the user across devices. The draft is rendered
 * in from the server (no fetch on load) and cleared server-side when the note
 * is saved.
 */
export function NoteDraftProvider({
  initialDraft,
  children,
}: {
  /** Server-rendered draft to repopulate the composer with on load */
  initialDraft: string | null;
  children: ReactNode;
}) {
  const revealCreatedItem = useRevealCreatedItem();
  const queryClient = useQueryClient();
  const itemDialog = useItemDialog();
  const composingNote = itemDialog?.composingNote ?? false;
  const initialContent = initialDraft ?? "";
  const [markdown, setMarkdown] = useState(initialContent);
  const [editorContent, setEditorContent] = useState(initialContent);
  const [editorKey, setEditorKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Latest content and what the server holds once the draft writes already
  // sent land, so we can dedupe writes and flush the current text on page hide
  // without re-subscribing.
  const contentRef = useRef(initialContent);
  const savedContentRef = useRef(initialContent);
  const dirtyRef = useRef(false);
  // Counts draft writes sent, so a failed one only rolls back if none came after
  const draftWriteCountRef = useRef(0);
  // Every draft write still in flight, so a save can wait for them to land first
  const draftWritesRef = useRef<Promise<unknown>>(Promise.resolve());

  const isEmpty = isBlankNote(markdown);

  const persistDraft = useDebouncedCallback(async (value: string) => {
    // Counted as saved once sent: an edit back to the text before this write
    // must still be written, or this one lands last and brings its text back
    const previous = savedContentRef.current;
    savedContentRef.current = value;
    const writeNumber = ++draftWriteCountRef.current;
    const write = api.post(DRAFT_ENDPOINT, { content: value });
    draftWritesRef.current = Promise.all([
      draftWritesRef.current,
      write.catch(() => undefined),
    ]);
    try {
      await write;
      dirtyRef.current = false;
    } catch (error) {
      // Unless a newer write has been sent since
      if (draftWriteCountRef.current === writeNumber) {
        savedContentRef.current = previous;
      }
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

  // Back from the dialog (closed, or saved and now showing the note): remount
  // the card's editor with the latest text, which is empty after a save
  const wasComposingRef = useRef(composingNote);
  useEffect(() => {
    if (wasComposingRef.current && !composingNote) {
      setMarkdown(contentRef.current);
      setEditorContent(contentRef.current);
      setEditorKey((key) => key + 1);
    }
    wasComposingRef.current = composingNote;
  }, [composingNote]);

  // Empty the draft and drop any pending draft write. Only the refs, so the
  // dialog keeps showing the saved text until it becomes the saved note; the
  // editors pick it up from `remount`.
  const emptyDraft = useCallback(() => {
    persistDraft.cancel();
    contentRef.current = "";
    savedContentRef.current = "";
    dirtyRef.current = false;
  }, [persistDraft]);

  const remount = useCallback(() => {
    setMarkdown(contentRef.current);
    setEditorContent(contentRef.current);
    setEditorKey((key) => key + 1);
  }, []);

  const handleClear = useCallback(() => {
    // Only hit the server if a draft was actually persisted
    if (!isBlankNote(savedContentRef.current)) {
      void api
        .delete(DRAFT_ENDPOINT)
        .catch((error) => log.error({ error }, "Note draft clear error"));
    }
    emptyDraft();
    remount();
  }, [emptyDraft, remount]);

  // Two-step confirm so an accidental click can't discard the draft: first
  // click arms the button ("Confirm clear?"), the second clears.
  const clearConfirm = useConfirmAction({
    onConfirm: handleClear,
    revertDelayMs: 2000,
  });

  const onChange = useCallback(
    (value: string) => {
      // Any editing disarms a pending "Confirm clear"
      clearConfirm.reset();
      setMarkdown(value);
      contentRef.current = value;
      // Trailing blank lines don't change the note: the editor adds an empty
      // paragraph after a draft ending in a list on its first transaction,
      // which would otherwise rewrite the draft once on load
      if (value.trimEnd() === savedContentRef.current.trimEnd()) {
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

  const save = useCallback(
    async (from: "card" | "dialog") => {
      if (isEmpty || isSaving) return;
      setIsSaving(true);
      // Creating the note clears its server draft, so a draft write landing
      // after that would bring the saved text back as a draft: drop the pending
      // one, stop a mid-save tab hide beaconing it, and let ones already sent
      // finish first
      persistDraft.cancel();
      dirtyRef.current = false;
      await Promise.race([
        draftWritesRef.current,
        new Promise((resolve) => setTimeout(resolve, DRAFT_WRITE_WAIT_MS)),
      ]);
      try {
        const created = await api.post<Item>("/api/v1/items/notes", {
          content: markdown,
        });
        posthog.capture("note_created", {
          source: "composer",
          expanded: from === "dialog",
        });
        useMilestoneStore.getState().markComplete("write_first_note");
        void revealCreatedItem(created.id);
        emptyDraft();
        clearConfirm.reset();
        if (from === "dialog" && itemDialog) {
          // The dialog becomes the saved note's, in place: its frame stays up
          // and the body swaps. Primed so the note shows without a fetch; the
          // card picks up the emptied draft as the dialog leaves draft mode.
          queryClient.setQueryData(itemQueryKey(created.id), created);
          itemDialog.replaceOpenItem(created.id);
          toast.success("Note saved");
        } else {
          remount();
          toast.success("Note saved", {
            action: viewSavedItemAction(created.id),
          });
        }
      } catch (error) {
        log.error({ error }, "Note create error");
        toast.error("Failed to save note");
        // The text stays in the composer, so resume autosaving it
        if (contentRef.current !== savedContentRef.current) {
          dirtyRef.current = true;
          persistDraft(contentRef.current);
        }
      } finally {
        setIsSaving(false);
      }
    },
    [
      isEmpty,
      isSaving,
      markdown,
      itemDialog,
      queryClient,
      persistDraft,
      revealCreatedItem,
      emptyDraft,
      remount,
      clearConfirm.reset,
    ],
  );

  const value = useMemo(
    () => ({
      markdown,
      isEmpty,
      isSaving,
      editorContent,
      editorKey,
      onChange,
      save,
      clearConfirm,
    }),
    [
      markdown,
      isEmpty,
      isSaving,
      editorContent,
      editorKey,
      onChange,
      save,
      clearConfirm,
    ],
  );

  return (
    <NoteDraftContext.Provider value={value}>
      {children}
    </NoteDraftContext.Provider>
  );
}
