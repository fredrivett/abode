"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { IsLoading } from "@/components/ui/is-loading";
import { api } from "@/lib/api-client";
import { useUpdateCachedNoteContent } from "@/lib/api-hooks";
import { joinNoteTitle, splitNoteTitle } from "@/lib/items/note-title";
import { createLogger } from "@/lib/logger.client";
import { NoteDetailLayout } from "./note-detail-layout";
import { NoteEditor } from "./note-editor";

const log = createLogger("note/note-detail-view");

type NoteDetailViewProps = {
  itemId: string;
  /** The note's title, shown and edited as its first line */
  title: string | null;
  content: string;
  canEdit?: boolean;
  /** Called once a title edit is saved, so the card and tab title follow */
  onTitleSaved?: (title: string | null) => void;
  className?: string;
};

/**
 * Detail view for a note item: a markdown WYSIWYG editor that autosaves.
 *
 * Persistence mirrors the existing notes-field pattern (debounced PATCH), but
 * writes the note body to the item's note details `content`.
 *
 * The title is the editor's first line, as in the composer, so composing and
 * editing a note look the same. Each save splits it back off into the item's
 * `title`, which search, the card and the tab title read.
 */
export function NoteDetailView({
  itemId,
  title,
  content,
  canEdit = true,
  onTitleSaved,
  className,
}: NoteDetailViewProps) {
  // The editor's markdown, fixed at mount so a saved title doesn't re-sync it
  const [initialMarkdown] = useState(() => joinNoteTitle({ title, content }));
  const savedTitleRef = useRef(title);
  const [isSaving, setIsSaving] = useState(false);
  const hasTrackedRef = useRef(false);
  // Latest content we've persisted; null until the note is actually edited
  const savedContentRef = useRef<string | null>(null);
  const updateCachedNoteContent = useUpdateCachedNoteContent();

  const save = useDebouncedCallback(async (markdown: string) => {
    const next = splitNoteTitle(markdown);
    const titleChanged = next.title !== savedTitleRef.current;
    savedContentRef.current = next.content;
    setIsSaving(true);
    try {
      await api.patch(`/api/v1/items/${itemId}`, {
        content: next.content,
        ...(titleChanged && { title: next.title }),
      });
      if (titleChanged) {
        savedTitleRef.current = next.title;
        onTitleSaved?.(next.title);
      }
      hasTrackedRef.current = true;
    } catch (error) {
      log.error({ error }, "Note save error");
      toast.error("Failed to save note");
    } finally {
      setIsSaving(false);
    }
  }, 600);

  // On unmount (e.g. closing the dialog): flush the last debounced save so no
  // edits are lost, then patch just this item in the items cache so the card
  // preview and a re-opened detail view show the saved content — without
  // refetching every loaded page. Skipped entirely if the note wasn't edited.
  useEffect(
    () => () => {
      void save.flush();
      if (savedContentRef.current !== null) {
        updateCachedNoteContent(itemId, savedContentRef.current);
      }
    },
    [save, updateCachedNoteContent, itemId],
  );

  return (
    <NoteDetailLayout
      className={className}
      footer={
        canEdit ? (
          isSaving ? (
            <IsLoading label="Saving" iconClassName="size-3" />
          ) : null
        ) : undefined
      }
    >
      <NoteEditor
        content={initialMarkdown}
        editable={canEdit}
        autoFocus={canEdit && content.length === 0}
        onChange={canEdit ? save : undefined}
        titleFirst
      />
    </NoteDetailLayout>
  );
}
