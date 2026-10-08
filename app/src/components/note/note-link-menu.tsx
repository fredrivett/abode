"use client";

import { type Editor, getMarkRange, posToDOMRect } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEffect } from "react";
import { copyToClipboard } from "@/lib/copy";
import { NoteLinkMenuPanel } from "./note-link-menu-panel";
import { openNoteLink } from "./note-link-open";

const MENU_KEY = "noteLinkMenu";

/**
 * Floating link card for an editable note: shown while the caret (or a
 * selection) sits in a link — by click, tap or keyboard. Read-only notes don't
 * get it; their links open natively.
 */
export function NoteLinkMenu({ editor }: { editor: Editor }) {
  const href = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor.isEditable && editor.isActive("link")
        ? String(editor.getAttributes("link").href ?? "")
        : null,
  });

  // The plugin positions the menu before React renders its contents, so the
  // first placement measures an empty box and can overflow the viewport —
  // re-place it once the panel for this link has rendered
  useEffect(() => {
    if (href === null) return;
    editor.view.dispatch(editor.state.tr.setMeta(MENU_KEY, "updatePosition"));
  }, [editor, href]);

  return (
    <BubbleMenu
      editor={editor}
      pluginKey={MENU_KEY}
      className="z-50"
      shouldShow={({ editor, view, element }) =>
        editor.isEditable &&
        editor.isActive("link") &&
        (view.hasFocus() || element.contains(document.activeElement))
      }
      // Anchor under the whole link, not just the caret
      getReferencedVirtualElement={() => {
        const { state, view } = editor;
        const range = getMarkRange(
          state.selection.$from,
          state.schema.marks.link,
        );
        if (!range) return null;
        const rect = posToDOMRect(view, range.from, range.to);
        return {
          getBoundingClientRect: () => rect,
          getClientRects: () => [rect],
        };
      }}
      // Escape the editor's scroll/overflow box (the composer card clips).
      // Inside a dialog stay within it: its focus trap must reach the input
      appendTo={() => {
        const dialog = editor.view.dom.closest('[role="dialog"]');
        return dialog instanceof HTMLElement ? dialog : document.body;
      }}
      options={{
        placement: "bottom-start",
        offset: 6,
        flip: { padding: 8 },
        shift: { padding: 8 },
      }}
    >
      {href !== null && (
        // Keyed so moving to another link resets the edit state
        <NoteLinkMenuPanel
          key={href}
          href={href}
          onOpen={() => {
            editor.commands.focus();
            openNoteLink({ href, via: "menu" });
          }}
          onCopy={async () => {
            const copied = await copyToClipboard(href);
            editor.commands.focus();
            return copied;
          }}
          onSave={(next) =>
            editor
              .chain()
              .focus()
              .extendMarkRange("link")
              .setLink({ href: next })
              .run()
          }
          onRemove={() =>
            editor.chain().focus().extendMarkRange("link").unsetLink().run()
          }
          onCancelEdit={() => editor.commands.focus()}
          onEditBlur={(next) => {
            // Back into the note: the menu follows the caret as usual
            if (next instanceof Node && editor.view.dom.contains(next)) return;
            editor.view.dispatch(editor.state.tr.setMeta(MENU_KEY, "hide"));
          }}
        />
      )}
    </BubbleMenu>
  );
}
