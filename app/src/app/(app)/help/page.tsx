import Link from "next/link";
import { AbodeLogo } from "@/components/abode-logo";

export const metadata = {
  title: "Help | abode",
  description: "Get help with using abode to organize and find your items",
};

function Abode() {
  return (
    <span className="inline-flex items-baseline">
      <span className="sr-only">abode</span>
      <AbodeLogo
        className="ml-0.5 h-[0.8em] w-auto text-current"
        aria-hidden
      />
    </span>
  );
}

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <article className="prose prose-neutral dark:prose-invert prose-headings:font-serif prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-p:text-base">
        <h1>Help</h1>
        <p>
          Welcome to <Abode /> help. Here you'll find guides and documentation
          to help you get the most out of organizing and finding your items.
        </p>

        <h2>Getting Started</h2>
        <p>
          <Abode /> helps you organize and search through your items using
          natural language and powerful filters. You can search by typing what
          you're looking for, or use filters for precise control.
        </p>

        <h2>Topics</h2>
        <ul>
          <li>
            <Link href="/help/filtering">Filtering</Link> — Learn how to use
            filters to search and organize your items
          </li>
        </ul>
      </article>
    </div>
  );
}
