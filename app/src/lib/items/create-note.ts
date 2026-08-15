import { write } from "@/lib/db";
import type { ItemSource } from "./capture-source";
import { promoteNoteHeading } from "./note-title";
import { itemSelect, type RawItem } from "./query";

export type CreateNoteInput = {
  /** Markdown body as composed in-app */
  content?: string | null;
  /** Optional explicit title; when provided it wins and the body is left intact */
  title?: string | null;
  /** Entry point the note was saved from (in-app composer vs extension selection) */
  source: ItemSource;
};

/**
 * Creates a user-authored note item.
 *
 * Notes are composed in-app (markdown), so there's no URL fetch or background
 * classification — the item is created synchronously and marked completed.
 *
 * If no explicit title is given and the markdown opens with a heading, that
 * heading is lifted into the title (and out of the body) so the note behaves
 * like every other item's title. This is a one-shot transform, so title and
 * body never hold competing copies.
 */
export async function createNote(
  userId: string,
  input: CreateNoteInput,
): Promise<RawItem> {
  const explicitTitle = input.title?.trim() || null;
  const rawContent = typeof input.content === "string" ? input.content : "";
  const { title, content } = explicitTitle
    ? { title: explicitTitle, content: rawContent }
    : promoteNoteHeading(rawContent);

  return write.item.create({
    data: {
      kind: "note",
      sourceType: "compose",
      captureSource: input.source,
      processingStatus: "completed",
      userId,
      title,
      noteDetails: { create: { content } },
    },
    select: itemSelect,
  });
}
