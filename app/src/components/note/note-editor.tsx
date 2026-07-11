"use client";

import Document from "@tiptap/extension-document";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { NOTE_PROSE_CLASS, NOTE_PROSE_FONT_SIZE } from "./note-prose";

// A document whose first node must be a heading, so the note always opens with
// a title line (Notion-style). The required heading can't be deleted, only
// edited — an empty document is normalised to a single empty heading.
const TitleDocument = Document.extend({ content: "heading block*" });

// Style the mandatory first line as a title, overriding the flattened heading
// size from the shared prose. `[&>*:first-child]` has real specificity, so it
// beats the plugin's `:where()` heading rules.
const TITLE_HEADING_CLASS =
  "[&>*:first-child]:font-serif [&>*:first-child]:font-semibold [&>*:first-child]:text-[1.3em] [&>*:first-child]:leading-[1.2] [&>*:first-child]:text-foreground [&>*:first-child]:mb-[0.5em]";

type NoteEditorProps = {
  /** Initial markdown content */
  content: string;
  /** Whether the note can be edited */
  editable?: boolean;
  /** Called with the serialized markdown whenever the content changes */
  onChange?: (markdown: string) => void;
  /** Placeholder-ish empty state is handled by the caller; this focuses on input */
  autoFocus?: boolean;
  className?: string;
  /**
   * Require the first line to be a heading and style it as a title
   * (Notion-style). Use for composing; the detail view keeps the title in the
   * header instead.
   */
  titleFirst?: boolean;
};

// `max-md:text-[1rem]` keeps the editor root at 16px on small screens — prose-sm
// would drop it to 14px, which makes iOS Safari auto-zoom the UI on focus
const EDITOR_BASE_CLASS =
  "focus:outline-none min-h-[1.5rem] max-md:text-[1rem]!";

/**
 * WYSIWYG note editor backed by markdown.
 *
 * Renders TipTap with the official markdown extension so the canonical stored
 * format is markdown — the same format the article reader renders. Edits are
 * surfaced as markdown via `onChange`; the caller owns persistence/debouncing.
 */
export function NoteEditor({
  content,
  editable = true,
  onChange,
  autoFocus = false,
  className,
  titleFirst = false,
}: NoteEditorProps) {
  const extensions = useMemo(
    () =>
      titleFirst
        ? [TitleDocument, StarterKit.configure({ document: false }), Markdown]
        : [StarterKit, Markdown],
    [titleFirst],
  );

  const editor = useEditor({
    extensions,
    content,
    // Content (initial and via setContent) is provided as markdown
    contentType: "markdown",
    editable,
    // Avoid SSR hydration mismatches in Next.js
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: cn(
          EDITOR_BASE_CLASS,
          NOTE_PROSE_CLASS,
          titleFirst && TITLE_HEADING_CLASS,
          className,
        ),
        // Size comes from `--note-prose-size` (set per surface); this inline
        // style beats prose-sm's root without `!important`
        style: `font-size: ${NOTE_PROSE_FONT_SIZE}`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getMarkdown());
    },
  });

  // Keep editability in sync when the prop changes
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  // Sync external content changes that didn't originate from this editor
  useEffect(() => {
    if (!editor) return;
    if (content !== editor.getMarkdown()) {
      editor.commands.setContent(content, {
        emitUpdate: false,
        contentType: "markdown",
      });
    }
  }, [editor, content]);

  return <EditorContent editor={editor} />;
}
