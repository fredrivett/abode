"use client";

import {
  ArrowUpLeft,
  DoorOpen,
  LogOut,
  Plus,
  Settings,
  User,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { SaveAsRoomButton } from "@/app/(app)/dashboard/_components/save-as-room-button";
import { AbodeLogo } from "@/components/abode-logo";
import { UserAvatar } from "@/components/avatar/user-avatar";
import { SearchInput } from "@/components/search";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
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
import { UploadDialog } from "@/components/upload-dialog";
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
  availableInvites: number;
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
  const {
    avatarUrl: storeAvatarUrl,
    setAvatarUrl,
    invitesRemaining: storeInvitesRemaining,
    setInvitesRemaining,
  } = useUserStore();

  const initialAvatarUrl = isAuthenticated ? props.avatarUrl : null;
  const initialInvitesRemaining = isAuthenticated ? props.availableInvites : 0;
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Initialize store with server-fetched values on mount (only when undefined = not yet hydrated)
  // This prevents overwriting client-side updates (like avatar uploads) with stale server values
  useEffect(() => {
    if (isAuthenticated) {
      if (storeAvatarUrl === undefined) {
        setAvatarUrl(initialAvatarUrl ?? null);
      }
      if (storeInvitesRemaining === 0 && initialInvitesRemaining > 0) {
        setInvitesRemaining(initialInvitesRemaining);
      }
    }
  }, [
    initialAvatarUrl,
    setAvatarUrl,
    storeAvatarUrl,
    initialInvitesRemaining,
    setInvitesRemaining,
    storeInvitesRemaining,
    isAuthenticated,
  ]);

  // Use store value if hydrated (not undefined), otherwise fall back to initial
  // Note: null means "explicitly no avatar", undefined means "not yet hydrated"
  const avatarUrl =
    storeAvatarUrl !== undefined ? storeAvatarUrl : (initialAvatarUrl ?? null);
  const invitesRemaining = storeInvitesRemaining ?? initialInvitesRemaining;

  // Compute display values for the user dropdown
  // If user has a name (first and/or last), show name on line 1 and @username on line 2
  // Otherwise, show @username on line 1 and email on line 2
  const hasName = isAuthenticated && (props.firstName || props.lastName);
  const fullName = isAuthenticated
    ? [props.firstName, props.lastName].filter(Boolean).join(" ")
    : null;
  const displayLine1 = hasName
    ? fullName
    : isAuthenticated && props.username
      ? `@${props.username}`
      : null;
  const displayLine2 = hasName
    ? props.username
      ? `@${props.username}`
      : null
    : isAuthenticated
      ? props.email || null
      : null;

  // Determine logo link destination
  const logoHref = isAuthenticated ? "/dashboard" : "/";

  return (
    <header className="sticky top-0 z-50 flex w-full flex-wrap items-start gap-x-4 gap-y-3 bg-background p-4 md:flex-nowrap md:gap-y-0 xl:gap-x-8">
      <div className="relative order-1 flex h-8 shrink-0 items-center">
        <h1>
          <Link
            href={logoHref}
            className="flex p-3 -m-3 opacity-50 transition-opacity hover:opacity-100"
          >
            <span className="sr-only">abode</span>
            <AbodeLogo className="h-6 w-auto text-foreground" aria-hidden />
          </Link>
        </h1>
        {showHomeLink && (
          <Link
            href={isAuthenticated ? "/dashboard" : "/"}
            className="group/home absolute top-full left-2 mt-1 hidden items-center whitespace-nowrap pl-5 text-sm text-foreground opacity-30 transition-opacity hover:opacity-100 xl:flex"
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
                <Button
                  variant="ghost-subtle"
                  size="icon"
                  onClick={() => setUploadDialogOpen(true)}
                  aria-label="Add item"
                >
                  <Plus size={18} aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                add item
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="ghost-subtle" size="icon">
                  <Link href="/rooms" aria-label="Rooms">
                    <DoorOpen size={18} aria-hidden />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                <span className="font-mono">/rooms</span>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="ghost-subtle" size="icon">
                  <Link
                    href="/settings/invites"
                    aria-label="Invites"
                    className="relative"
                  >
                    <UserPlus size={18} aria-hidden />
                    {invitesRemaining > 0 && (
                      <Badge
                        variant="outline"
                        className="absolute top-0 right-0 min-w-4 h-4 px-1 py-0 text-[10px] leading-none border-muted-foreground/20 bg-muted text-muted-foreground rounded"
                      >
                        {invitesRemaining}
                      </Badge>
                    )}
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                <span className="font-mono">
                  {invitesRemaining > 0
                    ? `${invitesRemaining} invite${invitesRemaining !== 1 ? "s" : ""} remaining`
                    : "No invites remaining"}
                </span>
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
                <div className="flex items-center gap-2 px-2 py-2">
                  <UserAvatar
                    avatarUrl={avatarUrl}
                    firstName={props.firstName}
                    lastName={props.lastName}
                    username={props.username}
                    email={props.email}
                    className="size-8"
                  />
                  <span className="flex flex-col items-start leading-tight">
                    {displayLine1 && (
                      <span className="text-sm font-medium">
                        {displayLine1}
                      </span>
                    )}
                    {displayLine2 && (
                      <span className="text-xs text-muted-foreground">
                        {displayLine2}
                      </span>
                    )}
                  </span>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href={`/@${props.username}`}
                    className="flex items-center gap-2"
                  >
                    <User className="size-4" />
                    View profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2">
                    <Settings className="size-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <form action={props.signOutAction}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2"
                    >
                      <LogOut className="size-4" />
                      Sign out
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <UploadDialog
              open={uploadDialogOpen}
              onOpenChange={setUploadDialogOpen}
            />
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
          <div className="order-3 flex w-full basis-full items-center gap-2 md:order-2 md:w-auto md:min-w-48 md:flex-1 md:basis-auto">
            <div className="flex-1">
              <SearchInput
                value={searchState}
                onChange={setSearchState}
                getFilterValues={getFilterValuesForType}
                placeholder="Find..."
              />
            </div>
            <SaveAsRoomButton searchState={searchState} />
          </div>
        )
      )}
    </header>
  );
}
