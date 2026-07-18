import { Search } from "lucide-react";
import { Suspense } from "react";
import { WaitlistForm } from "@/components/waitlist-form";
import { AccountDeletedToast } from "./_components/account-deleted-toast";

// TODO: repo is private until the security audit; make public before launch
const GITHUB_URL = "https://github.com/fredrivett/abode";

// three ways to gather, not fetch: visual, place + time, topical cluster
const SEARCH_EXAMPLES = [
  "orange armchair",
  "paris trip june 2026",
  "essays on typography",
];

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Suspense>
        <AccountDeletedToast />
      </Suspense>
      <main className="flex w-full max-w-2xl flex-col items-center px-4 py-20 text-center">
        <h1 className="text-balance font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          your home should be yours.
        </h1>
        <p className="mt-6 font-medium text-foreground text-xl sm:text-2xl">
          save everything. sort nothing. own it all.
        </p>
        <p className="mt-5 max-w-xl text-balance text-lg text-muted-foreground leading-relaxed">
          save the link, the photo, the tweet, the{" "}
          <span className="whitespace-nowrap">note-to-self</span>. then find it
          the way you think.
        </p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {SEARCH_EXAMPLES.map((example) => (
            <li
              key={example}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3.5 py-1.5 text-foreground text-sm"
            >
              <Search className="size-3.5 text-muted-foreground" aria-hidden />
              {example}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-muted-foreground text-sm">
          no folders, no tags, no digging.
        </p>

        <div className="mt-9 w-full max-w-sm">
          <WaitlistForm />
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

        <p className="mt-6 text-muted-foreground text-sm">
          already have an invite?{" "}
          <a
            href="/join"
            className="font-medium text-foreground hover:underline"
          >
            join here
          </a>
        </p>
      </main>
    </div>
  );
}
