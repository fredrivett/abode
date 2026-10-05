import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MarkdownRenderer } from "../_components/markdown-renderer";

export const metadata = {
  title: "Saving PDFs Help | abode",
  description: "Learn how to save PDFs as searchable documents",
};

async function getPdfsContent() {
  const filePath = join(process.cwd(), "src/content/help/pdfs.md");
  return readFile(filePath, "utf-8");
}

/**
 * Help page explaining PDF uploads, rendered from a Markdown file.
 */
export default async function PdfsHelpPage() {
  const pdfsContent = await getPdfsContent();

  return (
    <div className="mx-auto max-w-2xl">
      <MarkdownRenderer content={pdfsContent} />
    </div>
  );
}
