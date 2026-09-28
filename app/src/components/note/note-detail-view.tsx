"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { IsLoading } from "@/components/ui/is-loading";
import { api } from "@/lib/api-client";
import { useUpdateCachedNoteContent } from "@/lib/api-hooks";
import { createLogger } from "@/lib/logger.client";
import { NoteDetailLayout } from "./note-detail-layout";
import { NoteEditor } from "./note-editor";

const log = createLogger("note/note-detail-view");

type NoteDetailViewProps = {
  itemId: string;
  content: string;
  canEdit?: boolean;
  className?: string;
};

/**
 * Detail view for a note item: a markdown WYSIWYG editor that autosaves.
 *
 * Persistence mirrors the existing notes-field pattern (debounced PATCH), but
 * writes the note body to the item's note details `content`.
 */
export function NoteDetailView({
  itemId,
  content,
  canEdit = true,
  className,
}: NoteDetailViewProps) {
  const [isSaving, setIsSaving] = useState(false);
  const hasTrackedRef = useRef(false);
  // Latest content we've persisted; null until the note is actually edited
  const savedContentRef = useRef<string | null>(null);
  const updateCachedNoteContent = useUpdateCachedNoteContent();

  const save = useDebouncedCallback(async (value: string) => {
    savedContentRef.current = value;
    setIsSaving(true);
    try {
      await api.patch(`/api/v1/items/${itemId}`, { content: value });
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
        content={content}
        editable={canEdit}
        autoFocus={canEdit && content.length === 0}
        onChange={canEdit ? save : undefined}
      />
    </NoteDetailLayout>
  );
}
