import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getAppBaseUrl } from "@/lib/url";
import { MarkdownRenderer } from "../_components/markdown-renderer";

export const metadata = {
  title: "Saving from Your Phone Help | abode",
  description: "Save links to abode from your phone's share sheet",
};

async function getSavingFromPhoneContent() {
  const filePath = join(
    process.cwd(),
    "src/content/help/saving-from-your-phone.md",
  );
  const content = await readFile(filePath, "utf-8");
  // The iOS Shortcut has to point at this instance (self-hosters included)
  return content.replaceAll("{{appUrl}}", getAppBaseUrl());
}

/**
 * Help page explaining how to save from the phone share sheet (Android
 * install, iOS Shortcut), rendered from a Markdown file.
 */
export default async function SavingFromPhoneHelpPage() {
  const content = await getSavingFromPhoneContent();

  return (
    <div className="mx-auto max-w-2xl">
      <MarkdownRenderer content={content} />
    </div>
  );
}
