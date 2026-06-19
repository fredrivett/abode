/**
 * Lightweight markdown → plain text for previews (card excerpts, search snippets).
 *
 * This is intentionally cheap and lossy — it strips the common markdown syntax
 * so a preview reads as prose. It is NOT a parser; for rendering use a proper
 * markdown renderer.
 */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → text
    .replace(/^>\s?/gm, "") // blockquotes
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/^[\s]*[-*+]\s+/gm, "") // bullet list markers
    .replace(/^[\s]*\d+\.\s+/gm, "") // ordered list markers
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)(.*?)\1/g, "$2") // italic
    .replace(/~~(.*?)~~/g, "$1") // strikethrough
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n") // collapse blank lines
    .trim();
}
