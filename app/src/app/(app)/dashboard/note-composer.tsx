"use client";

import { Maximize2 } from "lucide-react";
import posthog from "posthog-js";
import type { KeyboardEvent } from "react";
import { LazyNoteEditor } from "@/components/note/lazy-note-editor";
import { NOTE_PROSE_FONT_SIZE } from "@/components/note/note-prose";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import { gridCardStyle } from "@/lib/grid-styles";
import { NEW_NOTE_ITEM } from "@/lib/items/item-dialog-url";
import { useItemDialog } from "./item-dialog-context";
import { useNoteDraft } from "./note-draft-context";

type NoteComposerProps = {
  /** Greys out and blocks interaction while a search is in flight */
  disabled?: boolean;
};

/** "Take a note…" over an empty draft, sized like the title line */
export function NoteDraftPlaceholder() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 font-semibold font-serif text-muted-foreground/70 leading-[1.2]"
      style={{ fontSize: `calc(1.3 * ${NOTE_PROSE_FONT_SIZE})` }}
    >
      Take a note…
    </span>
  );
}

/** The draft's Clear and Save buttons, shown once it has content */
export function NoteDraftActions({
  from,
  disabled,
}: {
  from: "card" | "dialog";
  disabled?: boolean;
}) {
  const draft = useNoteDraft();
  if (!draft || draft.isEmpty) return null;
  const { clearConfirm, isSaving } = draft;
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={clearConfirm.onClick}
        {...clearConfirm.hoverProps}
        disabled={isSaving || disabled}
        className={
          clearConfirm.confirming
            ? "text-destructive hover:text-destructive"
            : undefined
        }
      >
        {clearConfirm.confirming ? "Confirm clear?" : "Clear"}
      </Button>
      <Button
        size="sm"
        onClick={() => void draft.save(from)}
        disabled={isSaving || disabled}
      >
        {isSaving ? <IsLoading label="Saving" /> : "Save"}
      </Button>
    </>
  );
}

/**
 * Inline note composer — the first card in the grid (mymind-style "take a note").
 *
 * Sized as a 1:1 card matching a note card. Always editable: a placeholder shows
 * when empty, and Save/Clear appear once there's content. The editor is styled to
 * match the note card preview, so typed text looks exactly as it will once saved.
 * Saving creates a note item synchronously and refreshes the grid. The draft
 * itself lives in {@link NoteDraftProvider}.
 *
 * The expand button (bottom right) opens the same draft in the item dialog
 * (`?item=new`), where saving turns it into the saved note in place.
 */
export function NoteComposer({ disabled }: NoteComposerProps) {
  const draft = useNoteDraft();
  const itemDialog = useItemDialog();
  if (!draft) return null;
  // The dialog edits the draft meanwhile; the card catches up when it closes
  const composingInDialog = itemDialog?.composingNote ?? false;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Escape") {
      e.preventDefault();
      draft.clearConfirm.onClick();
    } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void draft.save("card");
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: keyboard shortcuts for the inline composer
    <div
      className="group relative flex h-full w-full flex-col overflow-hidden border border-border border-dashed bg-card"
      style={{ ...gridCardStyle, padding: "1.25em" }}
      onKeyDown={handleKeyDown}
    >
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {draft.isEmpty && <NoteDraftPlaceholder />}
        <LazyNoteEditor
          key={draft.editorKey}
          content={draft.editorContent}
          // Read-only while saving: the save sends the click-time text and then
          // empties the composer, so an edit made meanwhile would be lost
          editable={!disabled && !draft.isSaving && !composingInDialog}
          onChange={draft.onChange}
          className="min-h-full"
          titleFirst
        />
      </div>
      {/* Always rendered so the expand button doesn't shift the editor when
          the first character makes Save/Clear appear */}
      <div className="mt-[0.75em] flex shrink-0 items-center justify-end gap-[0.5em]">
        <NoteDraftActions from="card" disabled={disabled} />
        {itemDialog && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Expand note"
            title="Expand"
            onClick={() => {
              posthog.capture("note_composer_expanded");
              itemDialog.openItem(NEW_NOTE_ITEM);
            }}
            disabled={disabled}
            // Shown on hover/focus; always on touch, which has no hover
            className="text-muted-foreground any-pointer-coarse:opacity-100 opacity-0 focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
          >
            <Maximize2 />
          </Button>
        )}
      </div>
    </div>
  );
}
