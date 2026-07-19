import { Suspense } from "react";
import { GitHubStars, StarButton } from "./github-stars";

/**
 * A note that floats off to the right of the hero, pointing back at the word
 * "yours" — the ownership half of the pitch. Desktop only; on smaller screens
 * the ownership story lives in its own section further down the page.
 */
export function OwnershipCallout() {
  return (
    <div className="-bottom-11 pointer-events-none absolute left-full ml-6 hidden w-52 text-left xl:block">
      {/* solid connector arcing up and over, arrowhead pointing down-left at "yours." */}
      <svg
        aria-hidden="true"
        role="presentation"
        viewBox="0 0 140 100"
        className="-left-32 -top-8 absolute h-28 w-36 text-muted-foreground/50"
        fill="none"
      >
        <title>connector to the ownership note</title>
        <path
          d="M132 64 C 104 14, 46 4, 16 44"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M16 44 l 19 1 M16 44 l 4 -17"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>

      <div className="pointer-events-auto rounded-xl border border-border bg-background/60 p-4 shadow-sm backdrop-blur">
        <p className="text-foreground text-sm">
          open source &amp; self-hostable
        </p>
        <div className="mt-3">
          <Suspense fallback={<StarButton count={null} />}>
            <GitHubStars />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
