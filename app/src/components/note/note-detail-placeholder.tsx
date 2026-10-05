import Markdown from "markdown-to-jsx";
import { cn } from "@/lib/utils";
import { NoteDetailLayout } from "./note-detail-layout";
import {
  NOTE_EDITOR_CLASS,
  NOTE_PROSE_CLASS,
  NOTE_PROSE_FONT_SIZE,
} from "./note-prose";
import { TaskCheckbox } from "./task-checkbox";

/**
 * Shown while the note editor (a large lazy chunk) loads: the note's own
 * content, read-only, in the editor's layout and typography — so the editor
 * takes over in place rather than after a "Loading" flash. Uses the markdown
 * renderer the grid card already ships.
 */
export function NoteDetailPlaceholder({
  content,
  canEdit,
}: {
  content: string;
  canEdit: boolean;
}) {
  return (
    // Reserve the editor's status footer so nothing shifts when it swaps in
    <NoteDetailLayout footer={canEdit ? null : undefined}>
      <Markdown
        className={cn(NOTE_EDITOR_CLASS, NOTE_PROSE_CLASS)}
        style={{ fontSize: NOTE_PROSE_FONT_SIZE }}
        options={{
          forceBlock: true,
          wrapper: "div",
          overrides: { input: TaskCheckbox },
        }}
      >
        {content}
      </Markdown>
    </NoteDetailLayout>
  );
}
