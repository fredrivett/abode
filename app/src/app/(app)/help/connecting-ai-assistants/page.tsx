import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getAppBaseUrl } from "@/lib/url";
import { MarkdownRenderer } from "../_components/markdown-renderer";

export const metadata = {
  title: "Connecting AI Assistants Help | abode",
  description: "Let Claude, Cursor and other AI assistants search your abode",
};

async function getConnectingAiAssistantsContent() {
  const filePath = join(
    process.cwd(),
    "src/content/help/connecting-ai-assistants.md",
  );
  const content = await readFile(filePath, "utf-8");
  // The MCP server address has to point at this instance (self-hosters included)
  return content.replaceAll("{{appUrl}}", getAppBaseUrl());
}

/**
 * Help page explaining how to connect an AI assistant to abode's MCP server
 * with a read-scoped personal access token, rendered from a Markdown file.
 */
export default async function ConnectingAiAssistantsHelpPage() {
  const content = await getConnectingAiAssistantsContent();

  return (
    <div className="mx-auto max-w-2xl">
      <MarkdownRenderer content={content} />
    </div>
  );
}
