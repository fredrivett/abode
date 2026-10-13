import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MarkdownRenderer } from "../_components/markdown-renderer";

export const metadata = {
  title: "Highlighting Articles Help | abode",
  description: "Learn how to highlight articles and share your highlights",
};

async function getHighlightsContent() {
  const filePath = join(process.cwd(), "src/content/help/highlights.md");
  return readFile(filePath, "utf-8");
}

/**
 * Help page explaining article highlights and sharing them, rendered from a
 * Markdown file.
 */
export default async function HighlightsHelpPage() {
  const highlightsContent = await getHighlightsContent();

  return (
    <div className="mx-auto max-w-2xl">
      <MarkdownRenderer content={highlightsContent} />
    </div>
  );
}
