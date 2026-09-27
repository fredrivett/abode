import { decodeHtmlEntities } from "@/lib/html-metadata";

// Paragraph-ish line widths, so the skeleton reads as text, not a block
const LINES = ["100%", "96%", "99%", "88%", "100%", "93%", "62%"].map(
  (width, index) => ({ id: `line-${index}`, width }),
);

/**
 * Shown while the article reader (a large lazy chunk) loads: the reader's
 * layout with the title in place and skeleton paragraphs, so the article fills
 * in rather than replacing a "Loading" flash. Mirrors ArticleDetailView's
 * container and heading.
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
        {["first", "second"].map((paragraph) => (
          <div key={paragraph} className="mb-6 space-y-3">
            {LINES.map(({ id, width }) => (
              <div
                key={id}
                className="h-4 animate-pulse rounded bg-muted"
                style={{ width }}
              />
            ))}
          </div>
        ))}
      </article>
    </div>
  );
}
