import { Suspense } from "react";
import { AbodeLogo } from "@/components/abode-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { WaitlistForm } from "@/components/waitlist-form";
import { XLink } from "@/components/x-link";
import { AccountDeletedToast } from "./_components/account-deleted-toast";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Suspense>
        <AccountDeletedToast />
      </Suspense>
      <main className="flex flex-col items-center px-4 text-center">
        <h1 className="mb-6 flex flex-col items-center">
          <span className="sr-only">abode</span>
          <AbodeLogo className="h-14 w-auto text-foreground" aria-hidden />
        </h1>
        <p className="mb-8 font-semibold font-serif text-muted-foreground text-xl">
          your digital home
        </p>
        <WaitlistForm />
        <p className="mt-4 text-muted-foreground text-sm">
          already have an invite?{" "}
          <a
            href="/join"
            className="font-medium text-foreground hover:underline"
          >
            join here
          </a>
        </p>
        <div className="mt-8 flex items-center gap-2">
          <ThemeToggle />
          <XLink />
        </div>
      </main>
    </div>
  );
}
