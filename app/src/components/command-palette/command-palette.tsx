"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Check,
  DoorOpen,
  FolderPlus,
  HelpCircle,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Moon,
  Palette,
  Plus,
  Search,
  Settings,
  Sun,
  SunMoon,
  User,
  UserPlus,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { RoomIcon } from "@/components/rooms/room-icon";
import { Badge } from "@/components/ui/badge";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { UploadDialog } from "@/components/upload-dialog";
import { signOut } from "@/lib/actions/auth";
import { useSearch } from "@/lib/search";
import {
  applyThemePreference,
  getCurrentPreference,
  storeThemePreference,
  type ThemePreference,
} from "@/lib/theme";
import { useCommandPaletteStore } from "@/stores/command-palette-store";

type UserProfile = {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

type Room = {
  id: string;
  name: string;
  emoji: string | null;
  slug: string;
  itemCount: number;
};

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const { open, setOpen, uploadDialogOpen, setUploadDialogOpen } =
    useCommandPaletteStore();

  const [inputValue, setInputValue] = useState("");
  const [page, setPage] = useState<"main" | "theme">("main");
  const [showAllRooms, setShowAllRooms] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemePreference>("auto");

  // Fetch user profile
  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["/api/v1/user/profile"],
  });

  // Fetch rooms (only if authenticated)
  const { data: rooms } = useQuery<Room[]>({
    queryKey: ["/api/v1/rooms"],
    enabled: !!profile,
  });

  const isAuthenticated = !!profile;

  // Update current theme when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentTheme(getCurrentPreference());
      setPage("main");
      setInputValue("");
      setShowAllRooms(false);
    }
  }, [open]);

  // Register keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // cmd+k / ctrl+k - Open command palette
      if (modifier && e.key === "k") {
        e.preventDefault();
        setOpen(!open);
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  // Navigation handler
  const navigate = useCallback(
    (path: string) => {
      router.push(path);
      setOpen(false);
    },
    [router, setOpen],
  );

  // Search handler
  const { setQuery } = useSearch();
  const handleSearch = useCallback(() => {
    if (!inputValue.trim()) return;

    if (pathname === "/dashboard") {
      setQuery(inputValue.trim());
    } else {
      router.push(`/dashboard?q=${encodeURIComponent(inputValue.trim())}`);
    }
    setOpen(false);
  }, [inputValue, pathname, setQuery, router, setOpen]);

  // Theme handler
  const handleThemeChange = useCallback((theme: ThemePreference) => {
    applyThemePreference(theme);
    storeThemePreference(theme);
    setCurrentTheme(theme);
    setPage("main");
  }, []);

  // Sign out handler
  const handleSignOut = useCallback(async () => {
    setOpen(false);
    await signOut();
  }, [setOpen]);

  // Handle item selection
  const handleSelect = useCallback(
    (value: string) => {
      // Handle special values
      if (value === "theme") {
        setPage("theme");
        return;
      }
      if (value === "theme-back") {
        setPage("main");
        return;
      }
      if (value.startsWith("theme-")) {
        const theme = value.replace("theme-", "") as ThemePreference;
        handleThemeChange(theme);
        return;
      }
      if (value === "add-item") {
        setOpen(false);
        setUploadDialogOpen(true);
        return;
      }
      if (value === "sign-out") {
        void handleSignOut();
        return;
      }
      if (value === "show-all-rooms") {
        setShowAllRooms(true);
        return;
      }
      // Navigation values are paths
      if (value.startsWith("/") || value.startsWith("@")) {
        navigate(value.startsWith("@") ? `/${value}` : value);
        return;
      }
    },
    [
      handleThemeChange,
      handleSignOut,
      navigate,
      setOpen,
      setUploadDialogOpen,
    ],
  );

  // Get display rooms (first 5 or all)
  const displayRooms = showAllRooms ? rooms : rooms?.slice(0, 5);
  const hasMoreRooms = rooms && rooms.length > 5 && !showAllRooms;

  // Get theme display label
  const themeLabels: Record<ThemePreference, string> = {
    light: "Light",
    dark: "Dark",
    auto: "System",
  };

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Command Palette"
        description="Search for commands or items..."
      >
        <CommandInput
          placeholder={
            page === "theme" ? "Select theme..." : "Type a command or search..."
          }
          value={inputValue}
          onValueChange={setInputValue}
        />
        <CommandList className="scroll-shadow-bottom lg:max-h-[calc(100vh-8rem)]">
          {/* Only show empty state for unauthenticated users - authenticated users always have search */}
          {!isAuthenticated && <CommandEmpty>No results found.</CommandEmpty>}

          {page === "theme" ? (
            // Theme submenu
            <CommandGroup heading="Theme">
              <CommandItem value="theme-light" onSelect={handleSelect}>
                <Sun className="size-4" />
                <span>Light</span>
                {currentTheme === "light" && (
                  <Check className="ml-auto size-4" />
                )}
              </CommandItem>
              <CommandItem value="theme-dark" onSelect={handleSelect}>
                <Moon className="size-4" />
                <span>Dark</span>
                {currentTheme === "dark" && (
                  <Check className="ml-auto size-4" />
                )}
              </CommandItem>
              <CommandItem value="theme-auto" onSelect={handleSelect}>
                <SunMoon className="size-4" />
                <span>System</span>
                {currentTheme === "auto" && (
                  <Check className="ml-auto size-4" />
                )}
              </CommandItem>
            </CommandGroup>
          ) : (
            // Main view
            <>
              {/* Navigation */}
              <CommandGroup heading="Navigation">
                {isAuthenticated ? (
                  <>
                    <CommandItem
                      value="/dashboard"
                      keywords={["dashboard", "home"]}
                      onSelect={handleSelect}
                    >
                      <LayoutDashboard className="size-4" />
                      <span>Dashboard</span>
                    </CommandItem>
                    <CommandItem
                      value="/rooms"
                      keywords={["rooms"]}
                      onSelect={handleSelect}
                    >
                      <DoorOpen className="size-4" />
                      <span>Rooms</span>
                    </CommandItem>
                    <CommandItem
                      value="/settings/account"
                      keywords={["settings"]}
                      onSelect={handleSelect}
                    >
                      <Settings className="size-4" />
                      <span>Settings</span>
                    </CommandItem>
                    <CommandItem
                      value="/settings/invites"
                      keywords={["invites"]}
                      onSelect={handleSelect}
                    >
                      <UserPlus className="size-4" />
                      <span>Invites</span>
                    </CommandItem>
                    {profile?.username && (
                      <CommandItem
                        value={`@${profile.username}`}
                        keywords={["profile", "view profile", "my profile"]}
                        onSelect={handleSelect}
                      >
                        <User className="size-4" />
                        <span>Profile</span>
                      </CommandItem>
                    )}
                    <CommandItem
                      value="/help"
                      keywords={["help"]}
                      onSelect={handleSelect}
                    >
                      <HelpCircle className="size-4" />
                      <span>Help</span>
                    </CommandItem>
                  </>
                ) : (
                  <>
                    <CommandItem
                      value="/"
                      keywords={["home"]}
                      onSelect={handleSelect}
                    >
                      <Home className="size-4" />
                      <span>Home</span>
                    </CommandItem>
                    <CommandItem
                      value="/login"
                      keywords={["log in", "login", "sign in"]}
                      onSelect={handleSelect}
                    >
                      <LogIn className="size-4" />
                      <span>Log in</span>
                    </CommandItem>
                    <CommandItem
                      value="/signup"
                      keywords={["sign up", "signup", "register"]}
                      onSelect={handleSelect}
                    >
                      <UserPlus className="size-4" />
                      <span>Sign up</span>
                    </CommandItem>
                  </>
                )}
              </CommandGroup>

              {/* Actions (authenticated only) */}
              {isAuthenticated && (
                <CommandGroup heading="Actions">
                  <CommandItem
                    value="add-item"
                    keywords={["add item", "new item", "upload"]}
                    onSelect={handleSelect}
                  >
                    <Plus className="size-4" />
                    <span>Add Item</span>
                  </CommandItem>
                  <CommandItem
                    value="/rooms/new"
                    keywords={["create room", "new room"]}
                    onSelect={handleSelect}
                  >
                    <FolderPlus className="size-4" />
                    <span>Create Room</span>
                  </CommandItem>
                  <CommandItem
                    value="sign-out"
                    keywords={["sign out", "logout", "log out"]}
                    onSelect={handleSelect}
                  >
                    <LogOut className="size-4" />
                    <span>Sign Out</span>
                  </CommandItem>
                </CommandGroup>
              )}

              {/* Appearance */}
              <CommandGroup heading="Appearance">
                <CommandItem
                  value="theme"
                  keywords={["change theme", "dark mode", "light mode", "appearance"]}
                  onSelect={handleSelect}
                >
                  <Palette className="size-4" />
                  <span>Change theme</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {themeLabels[currentTheme]}
                  </span>
                </CommandItem>
              </CommandGroup>

              {/* Rooms (authenticated only) */}
              {isAuthenticated && rooms && rooms.length > 0 && (
                <CommandGroup heading="Rooms">
                  {displayRooms?.map((room) => (
                    <CommandItem
                      key={room.id}
                      value={`${room.name} ${room.slug}`}
                      keywords={["room", "rooms"]}
                      onSelect={() =>
                        navigate(`/@${profile?.username}/${room.slug}`)
                      }
                    >
                      {room.emoji ? (
                        <span className="text-base">{room.emoji}</span>
                      ) : (
                        <RoomIcon className="size-4 text-muted-foreground" />
                      )}
                      <span>{room.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {room.itemCount} item{room.itemCount !== 1 ? "s" : ""}
                      </span>
                    </CommandItem>
                  ))}
                  {hasMoreRooms && (
                    <CommandItem
                      value="show-all-rooms"
                      keywords={["show all rooms", "more rooms"]}
                      onSelect={handleSelect}
                    >
                      <span className="text-muted-foreground">
                        Show all {rooms.length} rooms...
                      </span>
                    </CommandItem>
                  )}
                </CommandGroup>
              )}

              {/* Search (authenticated only, always last, only when there's a search term) */}
              {isAuthenticated && inputValue && (
                <CommandGroup heading="Search" forceMount>
                  <CommandItem
                    value={`search-query-${inputValue}`}
                    keywords={["search", "find", "search your abode", inputValue]}
                    onSelect={handleSearch}
                    forceMount
                  >
                    <Search className="size-4" />
                    <span>Search your abode for</span>
                    <Badge variant="secondary">{inputValue}</Badge>
                  </CommandItem>
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>

      {/* Upload dialog - shared state */}
      <UploadDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen} />
    </>
  );
}
