import { Download, Github, Server, ShieldCheck } from "lucide-react";
import { Suspense } from "react";
import { GitHubStars, StarButton } from "./github-stars";
import { Highlight } from "./highlight";

const PILLARS = [
  {
    icon: Github,
    title: "open source",
    body: "every line is on github. audit it, fork it, trust it.",
  },
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
  {
    icon: ShieldCheck,
    title: "not the product",
    body: "no ads, no tracking, no data mining. your mind is never for sale.",
  },
];

/**
 * The ownership half of the pitch, told in full below the capture section —
 * open source, self-hostable, your data stays yours. Text-led; the hero's
 * (xl-only) OwnershipCallout points here for smaller screens.
 */
export function OwnershipSection() {
  return (
    <section className="w-full px-4 py-24 sm:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-balance font-serif text-4xl leading-[1.1] tracking-tight sm:text-5xl">
          your data. <Highlight>your rules.</Highlight>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-balance text-lg text-muted-foreground leading-relaxed">
          abode is open source and self-hostable — no ads, no lock-in, no one
          mining your mind.
        </p>
      </div>

      <ul className="mx-auto mt-16 grid max-w-3xl gap-x-12 gap-y-10 sm:grid-cols-2">
        {PILLARS.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <li key={pillar.title} className="flex flex-col gap-2 text-left">
              <div className="flex items-center gap-2.5">
                <Icon className="size-5 text-foreground" aria-hidden />
                <h3 className="font-medium text-lg">{pillar.title}</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {pillar.body}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="mt-16 flex justify-center">
        <Suspense fallback={<StarButton count={null} size="xl" />}>
          <GitHubStars size="xl" />
        </Suspense>
      </div>
    </section>
  );
}
