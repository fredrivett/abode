import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { requireCompletedSignup } from "@/lib/auth/require-completed-signup";
import { MarkdownRenderer } from "../_components/markdown-renderer";

export const metadata = {
  title: "Writing Notes Help | abode",
  description: "Learn how to write, expand and edit notes",
};

async function getNotesContent() {
  const filePath = join(process.cwd(), "src/content/help/notes.md");
  return readFile(filePath, "utf-8");
}

/**
 * Help page explaining how to write notes, including the full-screen editor,
 * rendered from a Markdown file.
 */
export default async function NotesHelpPage() {
  await requireCompletedSignup();
  const notesContent = await getNotesContent();

  return (
    <div className="mx-auto max-w-2xl">
      <MarkdownRenderer content={notesContent} />
    </div>
  );
}
