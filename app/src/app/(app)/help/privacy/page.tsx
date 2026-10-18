import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MarkdownRenderer } from "../_components/markdown-renderer";

export const metadata = {
  title: "Item Privacy Help | abode",
  description:
    "Learn how to keep items out of public rooms or mark them sensitive",
};

async function getPrivacyContent() {
  const filePath = join(process.cwd(), "src/content/help/privacy.md");
  return readFile(filePath, "utf-8");
}

/**
 * Help page explaining item privacy levels, rendered from a Markdown file.
 */
export default async function PrivacyHelpPage() {
  const privacyContent = await getPrivacyContent();

  return (
    <div className="mx-auto max-w-2xl">
      <MarkdownRenderer content={privacyContent} />
    </div>
  );
}
