import Link from "next/link";
import { COMPARISONS } from "@/lib/comparisons";
import { ABODE_FACTS } from "@/lib/comparisons/abode";
import { COMPARISON_ROWS, type Comparison } from "@/lib/comparisons/types";
import { ClosingCta } from "../../_components/closing-cta";
import { Highlight } from "../../_components/highlight";

export function formatCheckedDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** An honest, sourced "abode vs X" page */
export function ComparisonPage({ comparison }: { comparison: Comparison }) {
  const others = COMPARISONS.filter(({ slug }) => slug !== comparison.slug);

  return (
    <div className="flex w-full flex-1 flex-col items-center">
      <main className="w-full max-w-3xl px-4 pt-16 pb-8 sm:pt-24">
        <p className="text-muted-foreground text-sm">
          <Link href="/vs" className="hover:underline">
            compare
          </Link>
        </p>
        <h1 className="mt-3 text-balance font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          abode vs <Highlight>{comparison.name}</Highlight>
        </h1>
        <p className="mt-6 text-balance text-lg text-muted-foreground leading-relaxed">
          {comparison.intro}
        </p>

        <section aria-labelledby="side-by-side" className="mt-14">
          <h2 id="side-by-side" className="sr-only">
            side by side
          </h2>
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b">
                <th scope="col" className="w-1/4 py-3 pr-4 font-normal">
                  <span className="sr-only">feature</span>
                </th>
                <th scope="col" className="w-[37.5%] py-3 pr-4 font-medium">
                  abode
                </th>
                <th scope="col" className="w-[37.5%] py-3 font-medium">
                  {comparison.name}
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map(({ key, label }) => (
                <tr key={key} className="border-b align-top last:border-0">
                  <th
                    scope="row"
                    className="py-4 pr-4 font-normal text-muted-foreground"
                  >
                    {label}
                  </th>
                  <td className="py-4 pr-4 leading-relaxed">
                    {ABODE_FACTS[key]}
                  </td>
                  <td className="py-4 leading-relaxed">
                    {comparison.facts[key]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-16 grid gap-10 sm:grid-cols-2">
          <div>
            <h2 className="font-serif text-2xl">
              where {comparison.name} shines
            </h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-muted-foreground leading-relaxed">
              {comparison.theyShine.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-serif text-2xl">where abode fits better</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-muted-foreground leading-relaxed">
              {comparison.abodeFits.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        </section>

        <footer className="mt-16 border-t pt-6 text-muted-foreground text-xs leading-relaxed">
          <p>
            checked against {comparison.name}&apos;s own site on{" "}
            {formatCheckedDate(comparison.lastChecked)}. prices and features
            change — see{" "}
            <a
              href={comparison.siteUrl}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {comparison.name}
            </a>{" "}
            for the latest. sources:{" "}
            {comparison.sources.map((source, i) => (
              <span key={source.url}>
                {i > 0 && ", "}
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {source.label}
                </a>
              </span>
            ))}
            .
          </p>
          {others.length > 0 && (
            <p className="mt-3">
              more comparisons:{" "}
              {others.map((other, i) => (
                <span key={other.slug}>
                  {i > 0 && " · "}
                  <Link href={`/vs/${other.slug}`} className="underline">
                    abode vs {other.name}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </footer>
      </main>

      <ClosingCta />
    </div>
  );
}
