"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";

import { AbodeLogo } from "@/components/abode-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials } from "@/lib/get-initials";

type DashboardHeaderProps = {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  signOutAction: () => Promise<void>;
};

export function DashboardHeader({
  email,
  firstName,
  lastName,
  avatarUrl,
  signOutAction,
}: DashboardHeaderProps) {
  const displayEmail = email || "Account";
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ").trim() || displayEmail;
  const initials = getInitials({ firstName, lastName, fallback: displayName });

  return (
    <header className="flex w-full items-center justify-between gap-4 p-4">
      <h1 className="flex items-center">
        <span className="sr-only">abode</span>
        <AbodeLogo className="h-6 w-auto text-foreground" aria-hidden />
      </h1>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Open account menu"
            >
              <Avatar className="size-8">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={displayName} />
                ) : null}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Button
                asChild
                variant="ghost"
                className="h-auto w-full justify-start px-2 py-2"
              >
                <Link href="/account">
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-sm font-medium">{displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      {displayEmail}
                    </span>
                  </span>
                </Link>
              </Button>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={signOutAction}>
              <DropdownMenuItem asChild>
                <Button
                  type="submit"
                  variant="ghost"
                  className="h-auto w-full justify-start gap-2 px-2 py-1.5"
                >
                  <LogOut className="size-4" />
                  Sign out
                </Button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
