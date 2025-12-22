"use client";

import { ArrowUpLeft, Blocks, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { AbodeLogo } from "@/components/abode-logo";
import { UserAvatar } from "@/components/avatar/user-avatar";
import { SearchInput } from "@/components/search";
import { ThemeToggle } from "@/components/theme-toggle";
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
import { getDisplayName } from "@/lib/get-display-name";
import { useFilterOptions, useSearch } from "@/lib/search";
import { useUserStore } from "@/stores/user-store";

type BaseProps = {
  showSearch?: boolean;
  showHomeLink?: boolean;
  /** Optional custom content for the center slot (replaces search input) */
  centerSlot?: ReactNode;
};

type AuthenticatedProps = BaseProps & {
  isAuthenticated: true;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  signOutAction: () => Promise<void>;
};

type UnauthenticatedProps = BaseProps & {
  isAuthenticated: false;
};

export type DashboardHeaderClientProps =
  | AuthenticatedProps
  | UnauthenticatedProps;

export function DashboardHeaderClient(props: DashboardHeaderClientProps) {
  const {
    showSearch = false,
    showHomeLink = false,
    isAuthenticated,
    centerSlot,
  } = props;

  const { state: searchState, setState: setSearchState } = useSearch();
  const { getFilterValuesForType } = useFilterOptions();
  const { avatarUrl: storeAvatarUrl, setAvatarUrl } = useUserStore();

  const initialAvatarUrl = isAuthenticated ? props.avatarUrl : null;

  // Initialize store with server-fetched value on mount
  useEffect(() => {
    if (isAuthenticated) {
      setAvatarUrl(initialAvatarUrl ?? null);
    }
  }, [initialAvatarUrl, setAvatarUrl, isAuthenticated]);

  // Use store value (falls back to initial if store not yet hydrated)
  const avatarUrl = storeAvatarUrl ?? initialAvatarUrl;

  const displayEmail = isAuthenticated ? props.email || "Account" : null;
  const displayName = isAuthenticated
    ? getDisplayName({
        firstName: props.firstName,
        lastName: props.lastName,
        username: props.username,
      })
    : null;

  // Determine logo link destination
  const logoHref = isAuthenticated ? "/dashboard" : "/";

  return (
    <header className="flex w-full flex-wrap items-start gap-x-4 gap-y-3 p-4 md:flex-nowrap md:gap-y-0 xl:gap-x-8">
      <div className="relative order-1 flex h-8 shrink-0 items-center">
        <h1>
          <Link
            href={logoHref}
            className="opacity-50 transition-opacity hover:opacity-100"
          >
            <span className="sr-only">abode</span>
            <AbodeLogo className="h-6 w-auto text-foreground" aria-hidden />
          </Link>
        </h1>
        {showHomeLink && isAuthenticated && (
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
        {isAuthenticated ? (
          <>
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
                  <UserAvatar
                    avatarUrl={avatarUrl}
                    firstName={props.firstName}
                    lastName={props.lastName}
                    username={props.username}
                    email={props.email}
                    className="size-8"
                  />
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
                        <span className="text-sm font-medium">
                          {displayName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {displayEmail}
                        </span>
                      </span>
                    </Link>
                  </Button>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2">
                    <Settings className="size-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <form action={props.signOutAction}>
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
          </>
        ) : (
          <>
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Log in</Link>
            </Button>
          </>
        )}
      </div>

      {/* Center slot: custom content, search input, or nothing */}
      {centerSlot ? (
        <div className="order-3 w-full basis-full md:order-2 md:w-auto md:min-w-48 md:flex-1 md:basis-auto">
          {centerSlot}
        </div>
      ) : (
        showSearch &&
        isAuthenticated && (
          <div className="order-3 w-full basis-full md:order-2 md:w-auto md:min-w-48 md:flex-1 md:basis-auto">
            <SearchInput
              value={searchState}
              onChange={setSearchState}
              getFilterValues={getFilterValuesForType}
              placeholder="Find..."
            />
          </div>
        )
      )}
    </header>
  );
}
