import Link from "next/link";
import type { ReactNode } from "react";
import { AbodeLogo } from "@/components/abode-logo";

// The header's layout, shared by the header and its loading skeleton so the
// skeleton can't drift from what replaces it

export function HeaderBar({ children }: { children: ReactNode }) {
  return (
    <header className="sticky top-0 z-50 flex w-full flex-wrap items-start gap-x-4 gap-y-3 bg-background p-4 lg:flex-nowrap lg:gap-y-0 xl:gap-x-8">
      {children}
    </header>
  );
}

/** The logo; `children` sits beside it (the "take me home" link) */
export function HeaderLogo({
  href,
  children,
}: {
  href: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative order-1 flex h-8 shrink-0 items-center">
      <h1>
        <Link
          href={href}
          className="-m-3 flex p-3 opacity-50 transition-opacity hover:opacity-100"
        >
          <span className="sr-only">abode</span>
          <AbodeLogo className="h-6 w-auto text-foreground" aria-hidden />
        </Link>
      </h1>
      {children}
    </div>
  );
}

export function HeaderActions({ children }: { children: ReactNode }) {
  return (
    <div className="order-2 xs:order-3 ml-auto flex h-8 shrink-0 items-center gap-2">
      {children}
    </div>
  );
}

/** The search row: its own line on narrow screens, between logo and actions from lg */
export function HeaderSearchSlot({ children }: { children: ReactNode }) {
  return (
    <div className="order-3 flex w-full basis-full items-center gap-2 lg:order-2 lg:w-auto lg:min-w-48 lg:flex-1 lg:basis-auto">
      {children}
    </div>
  );
}
