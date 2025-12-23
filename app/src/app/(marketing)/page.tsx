import { AbodeLogo } from "@/components/abode-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { WaitlistForm } from "@/components/waitlist-form";
import { XLink } from "@/components/x-link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <main className="flex flex-col items-center text-center px-4">
        <h1 className="flex flex-col items-center mb-6">
          <span className="sr-only">abode</span>
          <AbodeLogo className="h-14 w-auto text-foreground" aria-hidden />
        </h1>
        <p className="text-xl font-serif font-semibold text-muted-foreground mb-8">
          your digital home
        </p>
        <WaitlistForm />
        <p className="mt-4 text-sm text-muted-foreground">
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
