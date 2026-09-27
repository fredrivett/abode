import { decodeHtmlEntities } from "@/lib/html-metadata";
import { ARTICLE_PROSE_CLASS } from "./article-prose";

// Filler for the skeleton paragraphs: never shown (transparent), it just
// wraps into realistic line lengths
const PARAGRAPHS = [
  "Most improvements are small and compound quietly: a slightly faster build, a slightly clearer name, a test that catches the thing before it ships.",
  "Nobody notices any one of them, but everybody notices the sum over a year of steady, unglamorous work on the details.",
  "Pick the thing that irritates you every day and fix just that one.",
].map((text, index) => ({ id: `paragraph-${index}`, text }));

/**
 * Shown while the article reader (a large lazy chunk) loads: the reader's
 * layout with the title in place and skeleton paragraphs, so the article fills
 * in rather than replacing a "Loading" flash. Mirrors ArticleDetailView's
 * container and heading, and the skeleton lines are real text in the reader's
 * own prose styles (invisible, with a pulsing background per line) — so line
 * height, paragraph spacing and wrapping match at every breakpoint.
 */
export function ArticleDetailPlaceholder({
  title,
}: {
  title: string | undefined;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-12">
      <article className="mx-auto w-full max-w-prose" aria-busy>
        {title && (
          <h1 className="mb-6 font-bold font-serif text-2xl text-foreground md:text-3xl lg:mb-8 lg:text-4xl">
            {decodeHtmlEntities(title)}
          </h1>
        )}
        <div className={ARTICLE_PROSE_CLASS} aria-hidden>
          {PARAGRAPHS.map(({ id, text }) => (
            <p key={id}>
              <span className="animate-pulse select-none rounded bg-muted box-decoration-clone text-transparent">
                {text}
              </span>
            </p>
          ))}
        </div>
      </article>
    </div>
  );
}
