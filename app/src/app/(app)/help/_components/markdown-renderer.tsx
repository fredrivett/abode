"use client";

import Markdown from "markdown-to-jsx";
import { AbodeInline } from "./abode-inline";
import { FilterTypesTable } from "./filter-types-table";
import { HeadingIdProvider } from "./heading-id-context";
import { HeadingLink } from "./heading-link";

const markdownOptions = {
  overrides: {
    h1: {
      component: HeadingLink,
      props: { level: 1 },
    },
    h2: {
      component: HeadingLink,
      props: { level: 2 },
    },
    h3: {
      component: HeadingLink,
      props: { level: 3 },
    },
    FilterTypesTable: {
      component: FilterTypesTable,
    },
    Abode: {
      component: AbodeInline,
    },
  },
};

type MarkdownRendererProps = {
  content: string;
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <HeadingIdProvider>
      <article className="prose prose-neutral dark:prose-invert prose-headings:font-serif prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-base prose-h3:font-semibold prose-p:text-base prose-table:text-sm prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-sm prose-code:before:content-none prose-code:after:content-none">
        <Markdown options={markdownOptions}>{content}</Markdown>
      </article>
    </HeadingIdProvider>
  );
}
