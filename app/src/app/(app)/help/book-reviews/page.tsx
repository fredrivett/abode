import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MarkdownRenderer } from "../_components/markdown-renderer";

export const metadata = {
  title: "Reviewing Books Help | abode",
  description:
    "Learn how to track, rate and review books, and share your reviews",
};

async function getBookReviewsContent() {
  const filePath = join(process.cwd(), "src/content/help/book-reviews.md");
  return readFile(filePath, "utf-8");
}

/**
 * Help page explaining tracking and reviewing books, and sharing reviews,
 * rendered from a Markdown file.
 */
export default async function BookReviewsHelpPage() {
  const bookReviewsContent = await getBookReviewsContent();

  return (
    <div className="mx-auto max-w-2xl">
      <MarkdownRenderer content={bookReviewsContent} />
    </div>
  );
}
