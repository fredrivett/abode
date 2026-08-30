import { WaitlistForm } from "@/components/waitlist-form";
import { GITHUB_URL } from "@/lib/github";
import { Highlight } from "./highlight";

/**
 * The closing call-to-action — the final beat of the page. Restates the promise
 * and offers the two ways in (join the waitlist, or run it yourself), mirroring
 * the hero's waitlist block.
 */
export function ClosingCta() {
  return (
    <section className="w-full px-4 py-32 sm:py-48">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <h2 className="text-balance font-serif text-4xl leading-[1.1] tracking-tight sm:text-5xl">
          make yourself at <Highlight>home.</Highlight>
        </h2>
        <p className="mt-5 max-w-md text-balance text-lg text-muted-foreground leading-relaxed">
          come in, drop your things, stay a while.
        </p>

        <div className="mt-9 w-full max-w-sm rounded-2xl bg-muted/30 p-3">
          <WaitlistForm />
          <p className="mt-3 text-center text-muted-foreground text-sm">
            already have an invite?{" "}
            <a
              href="/join"
              className="font-medium text-foreground hover:underline"
            >
              join here
            </a>
          </p>
        </div>

        <p className="mt-4 text-muted-foreground text-sm">
          or{" "}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground hover:underline"
          >
            run it yourself →
          </a>
        </p>
      </div>
    </section>
  );
}
