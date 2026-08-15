import { Suspense } from "react";
import { WaitlistForm } from "@/components/waitlist-form";
import { GITHUB_URL } from "@/lib/github";
import { AccountDeletedToast } from "./_components/account-deleted-toast";
import { LivingGallery } from "./_components/living-gallery";
import { OwnershipCallout } from "./_components/ownership-callout";
import { SearchDemo } from "./_components/search-demo";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center">
      <Suspense>
        <AccountDeletedToast />
      </Suspense>
      <main className="relative z-10 flex min-h-[calc(100svh-3.5rem)] w-full max-w-2xl flex-col items-center justify-center px-4 py-12 text-center [text-shadow:0_1px_3px_rgba(0,0,0,0.9),0_4px_28px_rgba(0,0,0,0.7)]">
        <div className="relative w-full">
          <h1 className="text-balance font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            your home should be{" "}
            <span className="rounded-lg bg-foreground/[0.07] px-2 py-0.5">
              yours.
            </span>
          </h1>
          <OwnershipCallout />
        </div>
        <p className="mt-6 font-medium text-foreground text-xl sm:text-2xl">
          save everything. sort nothing. own it all.
        </p>
        <p className="mt-5 max-w-xl text-balance text-lg text-muted-foreground leading-relaxed">
          save the link, the photo, the tweet, the{" "}
          <span className="whitespace-nowrap">note-to-self</span>. then find it
          the way you think.
        </p>
        <div className="mt-7 w-full">
          <SearchDemo />
        </div>
        <p className="mt-4 text-muted-foreground text-sm">
          no folders, no tags, no digging.
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
      </main>

      <LivingGallery />
    </div>
  );
}
