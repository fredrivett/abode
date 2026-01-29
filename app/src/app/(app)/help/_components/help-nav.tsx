"use client";

import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type HelpNavItem = {
  href: string;
  label: string;
};

const helpPages: HelpNavItem[] = [
  { href: "/help/filtering", label: "Filtering" },
];

export function HelpNav() {
  const pathname = usePathname();

  return (
    <div className="-mx-4 scroll-shadow-x scroll-shadow-x-mobile md:mx-0">
      <nav className="flex gap-1 overflow-x-auto px-4 md:flex-col md:px-0">
        <span className="mb-2 hidden items-center gap-1.5 font-medium text-muted-foreground text-sm md:flex">
          <FileQuestion className="size-4" />
          Help
        </span>
        {helpPages.map((page) => {
          const isActive = pathname === page.href;
          return (
            <Link
              key={page.href}
              href={page.href}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors md:pr-3 md:pl-5.5",
                isActive
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {page.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
