import { ArrowUpRight, Download, Github, Server, Star } from "lucide-react";
import { Suspense } from "react";
import { formatStarCount, GITHUB_URL, getGitHubStars } from "@/lib/github";
import { Highlight } from "./highlight";
import { SpotlightCard } from "./spotlight-card";
import { SpotlightGrid } from "./spotlight-grid";

const TILES = [
  {
    icon: Server,
    title: "self-hostable",
    body: "run it on your own machine — your stuff never has to leave home.",
  },
  {
    icon: Download,
    title: "yours to export",
    body: "take everything with you whenever you like. no lock-in, ever.",
  },
];

/**
 * The ownership half of the pitch, told in full below the capture section —
 * open source, self-hostable, your data stays yours. A bento grid: "open
 * source" is the hero tile (carrying the star CTA), the rest flank it. The
 * hero's (xl-only) OwnershipCallout points here for smaller screens.
 */
export function OwnershipSection() {
  return (
    <section className="w-full px-4 py-24 sm:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-balance font-serif text-4xl leading-[1.1] tracking-tight sm:text-5xl">
          your data. <Highlight>your rules.</Highlight>
        </h2>
      </div>

      <SpotlightGrid className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
        {/* hero tile — open source, carries the CTA */}
        <SpotlightCard
          className="bg-gradient-to-br from-muted/50 to-muted/10 p-8 text-left sm:col-span-2 sm:row-span-2"
          contentClassName="justify-between"
        >
          <div className="flex flex-col gap-4">
            <Github className="size-7 text-foreground" aria-hidden />
            <h3 className="font-serif text-3xl leading-tight">open source</h3>
            <p className="max-w-sm text-muted-foreground leading-relaxed">
              every line is on github. audit it, fork it, trust it. no ads, no
              lock-in, no one mining your mind.
            </p>
          </div>
          <div className="mt-8">
            <Suspense fallback={<HeroStarButton count={null} />}>
              <HeroStars />
            </Suspense>
          </div>
        </SpotlightCard>

        {TILES.map((tile) => {
          const Icon = tile.icon;
          return (
            <SpotlightCard
              key={tile.title}
              className="bg-muted/20 p-6 text-left"
              contentClassName="gap-2"
            >
              <Icon className="size-5 text-foreground" aria-hidden />
              <h3 className="font-medium">{tile.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {tile.body}
              </p>
            </SpotlightCard>
          );
        })}
      </SpotlightGrid>
    </section>
  );
}

async function HeroStars() {
  const count = await getGitHubStars();
  return <HeroStarButton count={count} />;
}

function HeroStarButton({ count }: { count: number | null }) {
  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noreferrer"
      className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/70 px-4 py-2 font-medium text-sm transition-colors hover:bg-background"
    >
      <Github className="size-4" aria-hidden />
      star on github
      {count !== null && (
        <span className="inline-flex items-center gap-0.5 text-muted-foreground">
          <Star className="size-3 fill-current" aria-hidden />
          {formatStarCount(count)}
        </span>
      )}
      <ArrowUpRight className="size-3.5 text-muted-foreground" aria-hidden />
    </a>
  );
}
