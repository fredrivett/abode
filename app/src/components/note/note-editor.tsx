"use client";

import type { Editor } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { Markdown } from "tiptap-markdown";
import { cn } from "@/lib/utils";

/**
 * The Markdown extension augments editor storage at runtime but ships no types,
 * so we narrow access here rather than reaching into `any`.
 */
type MarkdownStorage = { markdown: { getMarkdown: () => string } };

function getMarkdown(editor: Editor): string {
  return (editor.storage as unknown as MarkdownStorage).markdown.getMarkdown();
}

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
};

const EDITOR_CLASS =
  "prose prose-sm md:prose-base prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[1.5rem]";

/**
 * WYSIWYG note editor backed by markdown.
 *
 * Renders TipTap with a markdown serializer so the canonical stored format is
 * markdown — the same format the article reader renders. Edits are surfaced as
 * markdown via `onChange`; the caller owns persistence/debouncing.
 */
export function NoteEditor({
  content,
  editable = true,
  onChange,
  autoFocus = false,
  className,
}: NoteEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content,
    editable,
    // Avoid SSR hydration mismatches in Next.js
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: cn(EDITOR_CLASS, className),
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(getMarkdown(editor));
    },
  });

  // Keep editability in sync when the prop changes
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  // Sync external content changes that didn't originate from this editor
  useEffect(() => {
    if (!editor) return;
    const current = getMarkdown(editor);
    if (content !== current) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [editor, content]);

  return <EditorContent editor={editor} />;
}
