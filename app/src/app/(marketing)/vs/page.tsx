import type { Metadata } from "next";
import Link from "next/link";
import { COMPARISONS } from "@/lib/comparisons";
import { ClosingCta } from "../_components/closing-cta";
import { Highlight } from "../_components/highlight";

const TITLE =
  "abode compared — an open-source alternative to mymind, Pinterest and more";
const DESCRIPTION =
  "how abode compares to mymind, Raindrop, Cosmos, Are.na and Pinterest: pricing, privacy, search, and who owns your data. honest, sourced, side by side.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/vs" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/vs",
    siteName: "abode",
    type: "website",
  },
};

export default function ComparisonsHub() {
  return (
    <div className="flex w-full flex-1 flex-col items-center">
      <main className="w-full max-w-3xl px-4 pt-16 pb-8 sm:pt-24">
        <h1 className="text-balance font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          abode, <Highlight>compared.</Highlight>
        </h1>
        <p className="mt-6 text-balance text-lg text-muted-foreground leading-relaxed">
          there are good places to keep the things you find. here&apos;s how
          abode stacks up — honestly, including where the others are the better
          pick.
        </p>

        <ul className="mt-12 divide-y border-y">
          {COMPARISONS.map((comparison) => (
            <li key={comparison.slug}>
              <Link
                href={`/vs/${comparison.slug}`}
                className="group flex items-baseline justify-between gap-6 py-6"
              >
                <span className="font-serif text-2xl group-hover:underline">
                  abode vs {comparison.name}
                </span>
                <span className="text-muted-foreground text-sm">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <ClosingCta />
    </div>
  );
}
