"use client";

import { decodeHtmlEntities } from "@/lib/html-metadata";
import { HighlightableArticle } from "./highlightable-article";

type ArticleDetailViewProps = {
  itemId: string;
  content: string;
  /** Original page title (from the article's HTML), shown as a heading */
  originalName?: string;
  scrollToHighlightId?: string | null;
};

/**
 * Detail view for an article item: the extracted reader content with
 * highlighting. Mirrors the other per-kind detail views (product/video/note)
 * so the item dialog renders each kind through a dedicated component.
 */
export function ArticleDetailView({
  itemId,
  content,
  originalName,
  scrollToHighlightId,
}: ArticleDetailViewProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-12">
      <article className="mx-auto w-full max-w-prose">
        {originalName && (
          <h1 className="mb-6 font-bold font-serif text-2xl text-foreground md:text-3xl lg:mb-8 lg:text-4xl">
            {decodeHtmlEntities(originalName)}
          </h1>
        )}
        <HighlightableArticle
          itemId={itemId}
          content={content}
          className="prose prose-sm md:prose-base lg:prose-lg prose-neutral dark:prose-invert max-w-none prose-headings:font-serif prose-li:font-serif prose-p:font-serif"
          scrollToHighlightId={scrollToHighlightId}
        />
      </article>
    </div>
  );
}
