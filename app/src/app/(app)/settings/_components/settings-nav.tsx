"use client";

import { Handshake, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/settings/account",
    label: "Account",
    icon: User,
  },
  {
    href: "/settings/invites",
    label: "Invites",
    icon: Handshake,
  },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <div className="-mx-4 scroll-shadow-x scroll-shadow-x-mobile md:mx-0">
      <nav className="flex gap-1 overflow-x-auto px-4 md:flex-col md:px-0">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 font-medium text-sm transition-colors md:gap-3",
                isActive
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
