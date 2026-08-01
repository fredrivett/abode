import Link from "next/link";
import { AbodeLogo } from "@/components/abode-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { XLink } from "@/components/x-link";

export function MarketingHeader() {
  return (
    <header className="relative z-10 w-full px-4 py-4">
      <nav className="flex items-center justify-between">
        <Link href="/" className="text-foreground">
          <AbodeLogo className="h-6 w-auto" aria-label="abode" />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <XLink />
          <Link
            href="/login"
            className="ml-1 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground"
          >
            login
          </Link>
        </div>
      </nav>
    </header>
  );
}
