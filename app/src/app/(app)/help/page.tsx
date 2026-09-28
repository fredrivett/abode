import Link from "next/link";
import { AbodeInline } from "@/components/abode-inline";

export const metadata = {
  title: "Help | abode",
  description: "Get help with using abode to organize and find your items",
};

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <article className="prose prose-neutral dark:prose-invert prose-h2:mt-8 prose-h2:mb-4 prose-headings:font-serif prose-h1:text-3xl prose-h2:text-2xl prose-p:text-base">
        <h1>Help</h1>
        <p>
          Welcome to <AbodeInline /> help. Here you'll find guides and
          documentation to help you get the most out of organizing and finding
          your items.
        </p>

        <h2>Getting Started</h2>
        <p>
          <AbodeInline /> helps you organize and search through your items using
          natural language and powerful filters. You can search by typing what
          you're looking for, or use filters for precise control.
        </p>

        <h2>Topics</h2>
        <ul>
          <li>
            <Link href="/help/filtering">Filtering</Link> — Learn how to use
            filters to search and organize your items
          </li>
          <li>
            <Link href="/help/scanning">Scanning documents</Link> — Scan
            multi-page documents with your camera
          </li>
          <li>
            <Link href="/help/saving-from-your-phone">
              Saving from your phone
            </Link>{" "}
            — Save links from your phone's share sheet
          </li>
          <li>
            <Link href="/help/connecting-ai-assistants">
              Connecting AI assistants
            </Link>{" "}
            — Let Claude, Cursor and other assistants search your abode
          </li>
        </ul>
      </article>
    </div>
  );
}
