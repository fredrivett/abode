"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AbodeLogo } from "@/components/abode-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { XLink } from "@/components/x-link";
import { cn } from "@/lib/utils";

export function MarketingHeader() {
  // Transparent over the hero; the backdrop + border fade in once scrolled so
  // content stays legible behind the sticky bar.
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b px-4 py-4 transition-all duration-300",
        scrolled
          ? "border-border/50 bg-background/60 backdrop-blur-md"
          : "border-transparent bg-transparent",
      )}
    >
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
