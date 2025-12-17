"use client";

import { ArrowUpLeft, Blocks, LogOut } from "lucide-react";
import Link from "next/link";

import { AbodeLogo } from "@/components/abode-logo";
import { SearchInput } from "@/components/search";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getInitials } from "@/lib/get-initials";
import { getFilterValuesForType, useSearch } from "@/lib/search";

type DashboardHeaderProps = {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  signOutAction: () => Promise<void>;
  showSearch?: boolean;
  showHomeLink?: boolean;
};

export function DashboardHeader({
  email,
  firstName,
  lastName,
  avatarUrl,
  signOutAction,
  showSearch = true,
  showHomeLink = false,
}: DashboardHeaderProps) {
  const { state: searchState, setState: setSearchState } = useSearch();

  const displayEmail = email || "Account";
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ").trim() || displayEmail;
  const initials = getInitials({ firstName, lastName, fallback: displayName });

  return (
    <header className="flex w-full flex-wrap items-start gap-x-4 gap-y-3 p-4 md:flex-nowrap md:gap-y-0 xl:gap-x-8">
      <div className="relative order-1 flex h-8 shrink-0 items-center">
        <h1>
          <Link
            href="/dashboard"
            className="opacity-50 transition-opacity hover:opacity-100"
          >
            <span className="sr-only">abode</span>
            <AbodeLogo className="h-6 w-auto text-foreground" aria-hidden />
          </Link>
        </h1>
        {showHomeLink && (
          <Link
            href="/dashboard"
            className="group/home absolute top-full left-2 mt-1 flex items-center whitespace-nowrap pl-5 text-sm text-foreground opacity-30 transition-opacity hover:opacity-100"
          >
            <ArrowUpLeft className="absolute left-0 size-3.5 transition-transform group-hover/home:-translate-x-0.5 group-hover/home:-translate-y-0.5 group-hover/home:scale-150" />
            take me
            <span className="ml-1 transition-all group-hover/home:font-serif">
              home
            </span>
          </Link>
        )}
      </div>

      <div className="order-2 ml-auto flex h-8 shrink-0 items-center gap-2 md:order-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost-subtle" size="icon">
              <Link href="/rooms" aria-label="Rooms">
                <Blocks size={18} aria-hidden />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            <span className="font-mono">/rooms</span>
          </TooltipContent>
        </Tooltip>
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

      {showSearch && (
        <div className="order-3 w-full basis-full md:order-2 md:w-auto md:min-w-48 md:flex-1 md:basis-auto">
          <SearchInput
            value={searchState}
            onChange={setSearchState}
            getFilterValues={getFilterValuesForType}
            placeholder="Find..."
          />
        </div>
      )}
    </header>
  );
}
