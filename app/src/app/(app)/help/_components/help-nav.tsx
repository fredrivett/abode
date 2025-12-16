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
    <nav className="flex flex-col gap-1">
      <span className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
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
              "rounded-md py-1.5 pl-5.5 pr-3 text-sm transition-colors",
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
  );
}
