import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MarkdownRenderer } from "../_components/markdown-renderer";

export const metadata = {
  title: "Filtering Help | abode",
  description: "Learn how to use filters to search and organize your items",
};

async function getFilteringContent() {
  const filePath = join(process.cwd(), "src/content/help/filtering.md");
  return readFile(filePath, "utf-8");
}

export default async function FilteringHelpPage() {
  const filteringContent = await getFilteringContent();

  return (
    <div className="mx-auto max-w-2xl">
      <MarkdownRenderer content={filteringContent} />
    </div>
  );
}
