"use client";

import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

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
  /** Override the default prose styling (e.g. to match the note card preview) */
  proseClassName?: string;
  /**
   * Root font-size applied as an inline style. Inline so it reliably beats
   * prose-sm's root size while still losing to the max-md anti-zoom guard
   * (which is `!important`) on small screens.
   */
  proseFontSize?: string;
};

// `max-md:text-[1rem]` keeps the editor root at 16px on small screens — prose-sm
// would drop it to 14px, which makes iOS Safari auto-zoom the UI on focus
const EDITOR_BASE_CLASS =
  "focus:outline-none min-h-[1.5rem] max-md:text-[1rem]!";
const DEFAULT_PROSE_CLASS =
  "prose prose-sm md:prose-base prose-neutral dark:prose-invert max-w-none";

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
  proseClassName,
  proseFontSize,
}: NoteEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
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
          proseClassName ?? DEFAULT_PROSE_CLASS,
          className,
        ),
        ...(proseFontSize ? { style: `font-size: ${proseFontSize}` } : {}),
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
