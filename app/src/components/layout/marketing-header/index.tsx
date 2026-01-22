"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AbodeLogo } from "@/components/abode-logo";

export function MarketingHeader() {
  const pathname = usePathname();
  const isHomepage = pathname === "/";

  return (
    <header className="w-full px-4 py-4">
      <nav className="flex items-center justify-between">
        {isHomepage ? (
          <div />
        ) : (
          <Link href="/" className="text-foreground">
            <AbodeLogo className="h-6 w-auto" aria-label="abode" />
          </Link>
        )}
        <Link
          href="/login"
          className="font-medium text-muted-foreground text-sm transition-colors hover:text-foreground"
        >
          login
        </Link>
      </nav>
    </header>
  );
}
