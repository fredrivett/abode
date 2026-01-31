"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowUpLeft,
  CircleHelp,
  Command,
  DoorOpen,
  Handshake,
  LogOut,
  Moon,
  MoreVertical,
  Plus,
  Settings,
  Shield,
  Sun,
  SunMoon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { SaveAsRoomButton } from "@/app/(app)/dashboard/_components/save-as-room-button";
import { AbodeLogo } from "@/components/abode-logo";
import { UserAvatar } from "@/components/avatar/user-avatar";
import { ChecklistPopover } from "@/components/checklist";
import { SearchInput } from "@/components/search";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { CountBadge } from "@/components/ui/count-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getModifierKeySymbol } from "@/lib/keyboard";
import { useFilterOptions, useSearch } from "@/lib/search";
import { useThemePreference } from "@/lib/use-theme-preference";
import { cn } from "@/lib/utils";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { useUserStore } from "@/stores/user-store";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  getBadge?: (props: { availableInvites: number }) => number | null;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/settings/invites",
    label: "Invites",
    icon: Handshake,
    getBadge: ({ availableInvites }) =>
      availableInvites > 0 ? availableInvites : null,
  },
];

/**
 * Search section component - separated to avoid calling useSearchParams
 * on pages that don't need search functionality.
 */
function HeaderSearchSection() {
  const { state: searchState, setState: setSearchState } = useSearch();
  const { getFilterValuesForType } = useFilterOptions();

  return (
    <div className="order-3 flex w-full basis-full items-center gap-2 md:order-2 md:w-auto md:min-w-48 md:flex-1 md:basis-auto">
      <div className="flex-1">
        <SearchInput
          value={searchState}
          onChange={setSearchState}
          getFilterValues={getFilterValuesForType}
          placeholder="Find..."
          focusShortcut
        />
      </div>
      <SaveAsRoomButton searchState={searchState} />
    </div>
  );
}

function MobileOverflowMenu({
  navItems,
  availableInvites,
  className,
}: {
  navItems: NavItem[];
  availableInvites: number;
  className?: string;
}) {
  const totalBadgeCount = navItems.reduce((sum, item) => {
    const badge = item.getBadge?.({ availableInvites });
    return sum + (badge ?? 0);
  }, 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost-subtle"
          size="icon"
          className={cn("relative", className)}
          aria-label="More options"
        >
          <MoreVertical size={18} aria-hidden />
          {totalBadgeCount > 0 && <CountBadge count={totalBadgeCount} />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* Checklist - renders as menu item */}
        <ChecklistPopover variant="menu-item" />

        <DropdownMenuSeparator />

        {navItems.map((item) => {
          const badge = item.getBadge?.({ availableInvites });
          return (
            <DropdownMenuItem key={item.href} asChild>
              <Link href={item.href} className="relative flex items-center gap-2">
                <item.icon className="size-4" />
                {item.label}
                {badge && (
                  <CountBadge
                    count={badge}
                    className="relative top-0 right-0 ml-auto"
                  />
                )}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
  isAdmin?: boolean;
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

  const {
    firstName: storeFirstName,
    lastName: storeLastName,
    username: storeUsername,
    email: storeEmail,
    avatarUrl: storeAvatarUrl,
    availableInvites: storeAvailableInvites,
    hydrateUser,
  } = useUserStore();

  const { setOpen, setUploadDialogOpen } = useCommandPaletteStore();
  const { mounted: themeMounted, preference: themePreference, toggle: toggleTheme } = useThemePreference();
  const router = useRouter();

  // Keyboard shortcut: Cmd+, to open settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        router.push("/settings/account");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  // Extract authenticated props for hydration (with type narrowing)
  const authProps = isAuthenticated ? props : null;

  // Hydrate store with server-fetched values on mount
  useEffect(() => {
    if (authProps) {
      hydrateUser({
        firstName: authProps.firstName,
        lastName: authProps.lastName,
        username: authProps.username,
        email: authProps.email,
        avatarUrl: authProps.avatarUrl,
        availableInvites: authProps.availableInvites,
      });
    }
  }, [authProps, hydrateUser]);

  // Use store value if hydrated, otherwise fall back to prop.
  // Props are used during SSR and initial client render (before useEffect hydrates the store).
  // After hydration, store values take over so mutations (e.g., name changes) reflect immediately.
  const firstName =
    storeFirstName !== undefined
      ? storeFirstName
      : (authProps?.firstName ?? null);
  const lastName =
    storeLastName !== undefined
      ? storeLastName
      : (authProps?.lastName ?? null);
  const username =
    storeUsername !== undefined
      ? storeUsername
      : (authProps?.username ?? null);
  const email =
    storeEmail !== undefined ? storeEmail : (authProps?.email ?? null);
  const avatarUrl =
    storeAvatarUrl !== undefined
      ? storeAvatarUrl
      : (authProps?.avatarUrl ?? null);
  const availableInvites =
    storeAvailableInvites !== undefined
      ? storeAvailableInvites
      : (authProps?.availableInvites ?? 0);

  // Compute display values for the user dropdown
  // If user has a name (first and/or last), show name on line 1 and @username on line 2
  // Otherwise, show @username on line 1 and email on line 2
  const hasName = firstName || lastName;
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || null;
  const displayLine1 = hasName
    ? fullName
    : username
      ? `@${username}`
      : null;
  const displayLine2 = hasName
    ? username
      ? `@${username}`
      : null
    : email || null;

  // Determine logo link destination
  const logoHref = isAuthenticated ? "/dashboard" : "/";

  return (
    <header className="sticky top-0 z-50 flex w-full flex-wrap items-start gap-x-4 gap-y-3 bg-background p-4 md:flex-nowrap md:gap-y-0 xl:gap-x-8">
      <div className="relative order-1 flex h-8 shrink-0 items-center">
        <h1>
          <Link
            href={logoHref}
            className="-m-3 flex p-3 opacity-50 transition-opacity hover:opacity-100"
          >
            <span className="sr-only">abode</span>
            <AbodeLogo className="h-6 w-auto text-foreground" aria-hidden />
          </Link>
        </h1>
        {showHomeLink && (
          <Link
            href={isAuthenticated ? "/dashboard" : "/"}
            className="group/home absolute top-full left-2 mt-1 hidden items-center whitespace-nowrap pl-5 text-foreground text-sm opacity-30 transition-opacity hover:opacity-100 xl:flex"
          >
            <ArrowUpLeft className="group-hover/home:-translate-x-0.5 group-hover/home:-translate-y-0.5 absolute left-0 size-3.5 transition-transform group-hover/home:scale-150" />
            take me
            <span className="ml-1 transition-all group-hover/home:font-serif">
              home
            </span>
          </Link>
        )}
      </div>

      <div className="order-2 xs:order-3 ml-auto flex h-8 shrink-0 items-center gap-2">
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

            {/* Rooms - always visible */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="ghost-subtle" size="icon">
                  <Link href="/rooms" aria-label="Rooms">
                    <DoorOpen size={18} aria-hidden />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                <span className="font-mono">rooms</span>
              </TooltipContent>
            </Tooltip>

            {/* Desktop-only nav items (Invites) */}
            {NAV_ITEMS.map((item) => {
              const badge = item.getBadge?.({ availableInvites });
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      variant="ghost-subtle"
                      size="icon"
                      className="xs:inline-flex hidden"
                    >
                      <Link href={item.href} aria-label={item.label} className="relative">
                        <item.icon size={18} aria-hidden />
                        {badge && (
                          <CountBadge
                            count={badge}
                            aria-label={`${badge} ${item.label.toLowerCase()} remaining`}
                          />
                        )}
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6}>
                    <span className="font-mono">{item.label.toLowerCase()}</span>
                  </TooltipContent>
                </Tooltip>
              );
            })}

            {/* Checklist - desktop only */}
            <div className="xs:block hidden">
              <ChecklistPopover />
            </div>

            {/* Mobile overflow menu */}
            <MobileOverflowMenu
              navItems={NAV_ITEMS}
              availableInvites={availableInvites}
              className="xs:hidden"
            />
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
                    firstName={firstName}
                    lastName={lastName}
                    username={username}
                    email={email}
                    className="size-8"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild className="p-0">
                  <Link
                    href={`/@${username}`}
                    className="flex items-center gap-2 px-2 py-2"
                  >
                    <UserAvatar
                      avatarUrl={avatarUrl}
                      firstName={firstName}
                      lastName={lastName}
                      username={username}
                      email={email}
                      className="size-8"
                    />
                    <span className="flex flex-col items-start leading-tight">
                      {displayLine1 && (
                        <span className="font-medium text-sm">
                          {displayLine1}
                        </span>
                      )}
                      {displayLine2 && (
                        <span className="text-muted-foreground text-xs">
                          {displayLine2}
                        </span>
                      )}
                    </span>
                  </Link>
                </DropdownMenuItem>
                {authProps?.isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="flex items-center gap-2">
                        <Shield className="size-4" />
                        Admin
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings/account" className="flex items-center gap-2">
                    <Settings className="size-4" />
                    <span className="flex-1">Settings</span>
                    <KbdGroup>
                      <Kbd>{getModifierKeySymbol()}</Kbd>
                      <Kbd>,</Kbd>
                    </KbdGroup>
                  </Link>
                </DropdownMenuItem>
                {themeMounted && (
                  <DropdownMenuItem
                    onClick={toggleTheme}
                    className="flex items-center gap-2"
                  >
                    {themePreference === "light" ? (
                      <Sun className="size-4" />
                    ) : themePreference === "dark" ? (
                      <Moon className="size-4" />
                    ) : (
                      <SunMoon className="size-4" />
                    )}
                    <span>
                      Theme:{" "}
                      {themePreference === "auto"
                        ? "System"
                        : themePreference === "light"
                          ? "Light"
                          : "Dark"}
                    </span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Command className="size-4" />
                  <span className="flex-1">Commands</span>
                  <KbdGroup>
                    <Kbd>{getModifierKeySymbol()}</Kbd>
                    <Kbd>K</Kbd>
                  </KbdGroup>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/help" className="flex items-center gap-2">
                    <CircleHelp className="size-4" />
                    Help
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
        showSearch && isAuthenticated && <HeaderSearchSection />
      )}
    </header>
  );
}
