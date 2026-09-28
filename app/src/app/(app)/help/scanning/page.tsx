import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MarkdownRenderer } from "../_components/markdown-renderer";

export const metadata = {
  title: "Scanning Documents Help | abode",
  description: "Learn how to scan multi-page documents with your camera",
};

async function getScanningContent() {
  const filePath = join(process.cwd(), "src/content/help/scanning.md");
  return readFile(filePath, "utf-8");
}

/**
 * Help page explaining the document scanner, rendered from a Markdown file.
 */
export default async function ScanningHelpPage() {
  const scanningContent = await getScanningContent();

  return (
    <div className="mx-auto max-w-2xl">
      <MarkdownRenderer content={scanningContent} />
    </div>
  );
}
