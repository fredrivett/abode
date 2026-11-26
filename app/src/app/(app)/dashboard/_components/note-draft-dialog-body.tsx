"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useState } from "react";
import { LazyNoteEditor } from "@/components/note/lazy-note-editor";
import { NoteDetailLayout } from "@/components/note/note-detail-layout";
import { DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { NoteDraftActions, NoteDraftPlaceholder } from "../note-composer";
import { useNoteDraft } from "../note-draft-context";
import { LOCATION_DROP_HINT } from "./location-dropzone";

// The saved note's detail rows, with a value width each
const DETAIL_ROWS = [
  ["Type", "w-10"],
  ["Size", "w-8"],
  ["Status", "w-20"],
  ["Saved", "w-28"],
  ["Source", "w-10"],
] as const;

/** A sidebar section's heading, with a bar where its header action goes */
function GhostSection({
  title,
  action,
  rowHeight = "h-5",
  children,
}: {
  title: string;
  /** Width of the header action ("Add tag" etc.), if the section has one */
  action?: string;
  /** The real header row's height, which its action button sets */
  rowHeight?: string;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className={cn("flex items-center justify-between", rowHeight)}>
        <h3 className="font-semibold text-muted-foreground/70 text-sm">
          {title}
        </h3>
        {action && <GhostBar className={action} />}
      </div>
      {children}
    </div>
  );
}

/** A line of text that isn't there yet, at a text line's height */
function GhostLine({ className }: { className: string }) {
  return (
    <div className="flex h-5 items-center">
      <GhostBar className={className} />
    </div>
  );
}

function GhostBar({ className }: { className: string }) {
  return (
    <div
      className={cn("h-2.5 rounded-full bg-muted-foreground/15", className)}
    />
  );
}

/**
 * The item dialog's draft mode (`?item=new`): the note composer's draft in the
 * note detail layout, beside a dimmed outline of the sidebar with Clear and
 * Save. Laid out like a saved note — the sidebar's width included, so the text
 * wraps the same — so when Save turns the dialog into the saved note's, the
 * text stays put and the sidebar's sections fill in.
 */
export function NoteDraftDialogBody() {
  const draft = useNoteDraft();
  // The editor mounts with the text at open and isn't re-synced while typing;
  // a Clear remounts it empty. A save leaves it as is until the saved note
  // replaces this body.
  const [opened] = useState(() => ({
    key: draft?.editorKey,
    content: draft?.markdown ?? "",
  }));

  // Warm the saved note's view while composing, so after Save it swaps in
  // rather than via its loading placeholder
  useEffect(() => {
    void import("@/components/note/note-detail-view");
  }, []);

  if (!draft) return null;
  const content =
    draft.editorKey === opened.key ? opened.content : draft.editorContent;

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void draft.save("dialog");
    }
  };

  return (
    <>
      <DialogTitle className="sr-only">New note</DialogTitle>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: keyboard shortcuts for the expanded composer */}
      <div
        className="flex min-h-0 flex-1 flex-col bg-background md:overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* The saved note's footer: reserved, so the pane is as tall */}
        <NoteDetailLayout className="min-h-0 flex-1" footer={null}>
          <div className="relative">
            {draft.isEmpty && <NoteDraftPlaceholder />}
            <LazyNoteEditor
              key={draft.editorKey}
              content={content}
              editable={!draft.isSaving}
              onChange={draft.onChange}
              autoFocus
              titleFirst
            />
          </div>
        </NoteDetailLayout>
      </div>
      {/* A dimmed outline of the saved note's sidebar, at its width and in its
          layout, so Save fills the sections in where they already are */}
      <div className="flex shrink-0 flex-col border-border border-t bg-background md:w-[400px] md:border-t-0 md:border-l">
        <div className="hidden p-6 pb-0 md:block" />
        <div className="flex flex-1 flex-col gap-8 px-6 py-3 md:pt-0 md:pb-6">
          {/* Labels only: nothing here works until the note is saved. Not on
              phones, where the sidebar sits under the note and the outline
              would push the note off the screen */}
          <div aria-hidden className="hidden flex-1 space-y-6 md:block">
            <GhostSection title="Details">
              <div className="space-y-1 text-sm">
                {DETAIL_ROWS.map(([label, width]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between"
                  >
                    <span className="text-muted-foreground/70">{label}</span>
                    <GhostBar className={width} />
                  </div>
                ))}
              </div>
            </GhostSection>
            <GhostSection title="Tags" action="w-16" />
            <GhostSection title="Location" action="w-4" rowHeight="h-6">
              {/* The real hint's text, hidden, so it wraps as the saved
                  sidebar's does in whatever font the browser has */}
              <p className="pt-1 text-sm">
                <span className="select-none rounded-full bg-muted-foreground/15 box-decoration-clone text-transparent">
                  {LOCATION_DROP_HINT}
                </span>
              </p>
            </GhostSection>
            <GhostSection title="Rooms" action="w-24" rowHeight="h-7">
              <GhostLine className="w-48" />
            </GhostSection>
            <GhostSection title="Links" action="w-16" rowHeight="h-7" />
            <GhostSection title="Notes" rowHeight="h-7">
              <div className="h-[100px] rounded-md border border-muted-foreground/20 border-dashed" />
            </GhostSection>
          </div>
          <div className="flex items-center justify-end gap-2">
            <NoteDraftActions from="dialog" />
          </div>
        </div>
      </div>
    </>
  );
}
