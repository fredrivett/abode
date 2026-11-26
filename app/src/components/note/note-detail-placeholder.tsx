import Markdown from "markdown-to-jsx";
import { joinNoteTitle } from "@/lib/items/note-title";
import { cn } from "@/lib/utils";
import { NoteDetailLayout } from "./note-detail-layout";
import {
  NOTE_EDITOR_CLASS,
  NOTE_PROSE_CLASS,
  NOTE_PROSE_FONT_SIZE,
  TITLE_HEADING_CLASS,
} from "./note-prose";
import { TaskCheckbox } from "./task-checkbox";

/**
 * Shown while the note editor (a large lazy chunk) loads: the note's own
 * content, read-only, in the editor's layout and typography — so the editor
 * takes over in place rather than after a "Loading" flash. Uses the markdown
 * renderer the grid card already ships. The title is its first line, as in
 * the editor; an untitled note keeps that line, empty.
 */
export function NoteDetailPlaceholder({
  title,
  content,
  canEdit,
}: {
  title: string | null;
  content: string;
  canEdit: boolean;
}) {
  // A zero-width space holds an untitled note's empty title line open
  const markdown = joinNoteTitle({ title: title ?? "\u200B", content });
  return (
    // Reserve the editor's status footer so nothing shifts when it swaps in
    <NoteDetailLayout footer={canEdit ? null : undefined}>
      <Markdown
        className={cn(NOTE_EDITOR_CLASS, NOTE_PROSE_CLASS, TITLE_HEADING_CLASS)}
        style={{ fontSize: NOTE_PROSE_FONT_SIZE }}
        options={{
          forceBlock: true,
          // Keep the wrapper (and its prose class and font size) even when
          // the note is a single paragraph
          forceWrapper: true,
          wrapper: "div",
          overrides: { input: TaskCheckbox },
        }}
      >
        {markdown}
      </Markdown>
    </NoteDetailLayout>
  );
}
