"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AbodeLogo } from "@/components/abode-logo";

export function MarketingHeader() {
  const pathname = usePathname();
  const isHomepage = pathname === "/";

  return (
    <header className="w-full py-4 px-4">
      <nav className="max-w-7xl mx-auto flex items-center justify-between">
        {isHomepage ? (
          <div />
        ) : (
          <Link href="/" className="text-foreground">
            <AbodeLogo className="h-6 w-auto" aria-label="abode" />
          </Link>
        )}
        <Link
          href="/login"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          login
        </Link>
      </nav>
    </header>
  );
}
