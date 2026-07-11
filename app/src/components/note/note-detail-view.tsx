"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { IsLoading } from "@/components/ui/is-loading";
import { api } from "@/lib/api-client";
import { createLogger } from "@/lib/logger.client";
import { cn } from "@/lib/utils";
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

  const save = useDebouncedCallback(async (value: string) => {
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

  // Flush any pending debounced save on unmount (e.g. closing the dialog)
  // so the last edits within the debounce window aren't lost
  useEffect(
    () => () => {
      save.flush();
    },
    [save],
  );

  return (
    <div className={cn("flex h-full w-full flex-col bg-background", className)}>
      <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-12">
        {/* Full-screen editor: comfortable fixed size instead of the grid's
            density-scaled note prose */}
        <div className="mx-auto w-full max-w-prose [--note-prose-size:1rem] md:[--note-prose-size:1.0625rem]">
          <NoteEditor
            content={content}
            editable={canEdit}
            autoFocus={canEdit && content.length === 0}
            onChange={canEdit ? save : undefined}
          />
        </div>
      </div>
      {canEdit && (
        <div className="flex h-6 items-center justify-end px-6 pb-2 text-muted-foreground text-xs">
          {isSaving ? (
            <IsLoading label="Saving" iconClassName="size-3" />
          ) : null}
        </div>
      )}
    </div>
  );
}
