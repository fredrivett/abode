import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Markdown from "markdown-to-jsx";
import { AbodeInline } from "../_components/abode-inline";
import { FilterTypesTable } from "../_components/filter-types-table";
import { HeadingIdProvider } from "../_components/heading-id-context";
import { HeadingLink } from "../_components/heading-link";

export const metadata = {
  title: "Filtering Help | abode",
  description: "Learn how to use filters to search and organize your items",
};

async function getFilteringContent() {
  const filePath = join(process.cwd(), "src/content/help/filtering.md");
  return readFile(filePath, "utf-8");
}

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

export default async function FilteringHelpPage() {
  const filteringContent = await getFilteringContent();

  return (
    <div className="mx-auto max-w-2xl">
      <HeadingIdProvider>
        <article className="prose prose-neutral dark:prose-invert prose-headings:font-serif prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-base prose-h3:font-semibold prose-p:text-base prose-table:text-sm prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-sm prose-code:before:content-none prose-code:after:content-none">
          <Markdown options={markdownOptions}>{filteringContent}</Markdown>
        </article>
      </HeadingIdProvider>
    </div>
  );
}
