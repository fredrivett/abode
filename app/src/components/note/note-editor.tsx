"use client";

import { Extension, InputRule } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { LinkModifierClick } from "./note-link-open";
import {
  NOTE_EDITOR_CLASS,
  NOTE_PROSE_CLASS,
  NOTE_PROSE_FONT_SIZE,
} from "./note-prose";

// A document whose first node must be a heading, so the note always opens with
// a title line (Notion-style). The required heading can't be deleted, only
// edited — an empty document is normalised to a single empty heading.
const TitleDocument = Document.extend({ content: "heading block*" });

// Typing `[ ] ` / `[x] ` at the start of a bullet item makes it a checklist
// item, so the markdown way of starting one (`- [ ] `) works. TaskItem's own
// rule only fires on a plain paragraph — in a bullet the brackets stayed as
// text, which then saved as `- [ ] …` and reopened as a checklist
const BulletToTaskItem = Extension.create({
  name: "bulletToTaskItem",
  addInputRules() {
    return [
      new InputRule({
        find: /^\[([ xX]?)\]\s$/,
        handler: ({ state, range, match, chain }) => {
          const { $from } = state.selection;
          const isFirstLineOfBullet =
            $from.depth >= 2 &&
            $from.node(-1).type.name === "listItem" &&
            $from.node(-2).type.name === "bulletList" &&
            $from.index(-1) === 0;
          if (!isFirstLineOfBullet) return null;
          chain()
            .deleteRange(range)
            .liftListItem("listItem")
            .toggleTaskList()
            .updateAttributes("taskItem", {
              checked: match[1]?.toLowerCase() === "x",
            })
            .run();
        },
      }),
    ];
  },
});

// Checklists (`- [ ]` / `- [x]` in markdown), nestable like other lists
const CHECKLIST_EXTENSIONS = [
  TaskList,
  TaskItem.configure({ nested: true }),
  BulletToTaskItem,
];

// A plain click in an editable note places the caret rather than navigating
// away mid-edit; ⌘/Ctrl-click opens instead
const LINK_OPTIONS = { openOnClick: false } as const;

/** The editor's extensions; exported so tests can round-trip markdown. */
export function noteEditorExtensions({ titleFirst }: { titleFirst: boolean }) {
  return titleFirst
    ? [
        TitleDocument,
        StarterKit.configure({ document: false, link: LINK_OPTIONS }),
        ...CHECKLIST_EXTENSIONS,
        Markdown,
        LinkModifierClick,
      ]
    : [
        StarterKit.configure({ link: LINK_OPTIONS }),
        ...CHECKLIST_EXTENSIONS,
        Markdown,
        LinkModifierClick,
      ];
}

// Style the mandatory first line as a title, overriding the flattened heading
// size from the shared prose. `[&>*:first-child]` has real specificity, so it
// beats the plugin's `:where()` heading rules.
const TITLE_HEADING_CLASS =
  "[&>*:first-child]:font-serif [&>*:first-child]:font-semibold [&>*:first-child]:text-[1.4em] [&>*:first-child]:leading-[1.2] [&>*:first-child]:text-foreground [&>*:first-child]:mb-[0.5em]";

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
    () => noteEditorExtensions({ titleFirst }),
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
          NOTE_EDITOR_CLASS,
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

  // Keep editability in sync when the prop changes. `emitUpdate: false` —
  // TipTap otherwise fires an "update" here, which reads as an edit and made
  // merely opening a note autosave it
  useEffect(() => {
    editor?.setEditable(editable, false);
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
