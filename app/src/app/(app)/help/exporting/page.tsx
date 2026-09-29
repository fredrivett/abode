import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MarkdownRenderer } from "../_components/markdown-renderer";

export const metadata = {
  title: "Exporting Your Data Help | abode",
  description: "Learn how to download a copy of everything in your abode",
};

async function getExportingContent() {
  const filePath = join(process.cwd(), "src/content/help/exporting.md");
  return readFile(filePath, "utf-8");
}

/**
 * Help page explaining the data export, rendered from a Markdown file.
 */
export default async function ExportingHelpPage() {
  const exportingContent = await getExportingContent();

  return (
    <div className="mx-auto max-w-2xl">
      <MarkdownRenderer content={exportingContent} />
    </div>
  );
}
