"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  DoorOpen,
  FolderPlus,
  Handshake,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RoomIcon } from "@/components/rooms/room-icon";
import { DateRangePicker } from "@/components/search/date-range-picker";
import { FilterChips } from "@/components/search/filter-chip";
import { FilterDropdown } from "@/components/search/filter-dropdown";
import { Badge } from "@/components/ui/badge";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { UploadDialog } from "@/components/upload-dialog";
import { signOut } from "@/lib/actions/auth";
import { matchesShortcut } from "@/lib/keyboard";
import { useSearch } from "@/lib/search";
import { parseFilterContext } from "@/lib/search/parse-filter-context";
import {
  createFilterId,
  FILTER_TYPES,
  type Filter,
  type FilterType,
  type SearchState,
  serializeSearchParams,
} from "@/lib/search/types";
import { useFilterOptions } from "@/lib/search/use-filter-options";
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

  const [searchState, setSearchState] = useState<SearchState>({
    query: "",
    filters: [],
  });
  const [page, setPage] = useState<"main" | "theme">("main");
  const [showAllRooms, setShowAllRooms] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemePreference>("auto");
  const [selectedValue, setSelectedValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dateFilterAppliedRef = useRef(false);

  // Filter values loading
  const { getFilterValuesForType } = useFilterOptions();
  const getFilterValuesRef = useRef(getFilterValuesForType);
  getFilterValuesRef.current = getFilterValuesForType;
  const [filterValues, setFilterValues] = useState<string[]>([]);
  const [loadingValues, setLoadingValues] = useState(false);

  // Parse current filter context from query
  const filterContext = useMemo(
    () => parseFilterContext(searchState.query),
    [searchState.query],
  );

  // Determine if filter dropdowns should be open
  const isSelectingFilterType = filterContext.mode === "types";
  const isSelectingNonDateValue =
    filterContext.mode === "values" && filterContext.filterType !== "date";
  const filterDropdownOpen = isSelectingFilterType || isSelectingNonDateValue;
  const datePickerOpen =
    filterContext.mode === "values" && filterContext.filterType === "date";

  // Only show search-only view when filters are active
  // Query text alone should still show the normal command list with search at bottom
  const hasActiveFilters = searchState.filters.length > 0;
  const hasQueryText = searchState.query.trim().length > 0;

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
      setSearchState({ query: "", filters: [] });
      setShowAllRooms(false);
      setFilterValues([]);
      setSelectedValue(""); // Reset selection to first item
    }
  }, [open]);

  // Load filter values when entering values mode (for non-date types)
  useEffect(() => {
    if (
      filterContext.mode === "values" &&
      filterContext.filterType &&
      filterContext.filterType !== "date"
    ) {
      setLoadingValues(true);
      getFilterValuesRef
        .current(filterContext.filterType)
        .then(setFilterValues)
        .catch(() => setFilterValues([]))
        .finally(() => setLoadingValues(false));
    } else if (filterContext.mode !== "values") {
      setFilterValues([]);
    }
  }, [filterContext.mode, filterContext.filterType]);

  // Register keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // cmd+k / ctrl+k - Open command palette (but not cmd+shift+k which focuses search)
      if (matchesShortcut(e, { key: "k", modifier: true, shift: false })) {
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
  const { setState: setSearchStoreState } = useSearch();
  const handleSearch = useCallback(() => {
    if (!searchState.query.trim() && searchState.filters.length === 0) return;

    if (pathname === "/dashboard") {
      // Update search state directly
      setSearchStoreState({
        query: searchState.query.trim(),
        filters: searchState.filters,
      });
    } else {
      // Build URL with query and filters
      const params = serializeSearchParams({
        query: searchState.query.trim(),
        filters: searchState.filters,
      });
      router.push(`/dashboard?${params.toString()}`);
    }
    setOpen(false);
  }, [searchState, pathname, setSearchStoreState, router, setOpen]);

  // Filter handlers
  const handleSelectFilterType = useCallback(
    (type: FilterType) => {
      // Insert @type: into the query
      const beforeFilter = searchState.query.slice(0, filterContext.prefixEnd);
      const newQuery = `${beforeFilter}@${type}:`;
      setSearchState((prev) => ({ ...prev, query: newQuery }));
      inputRef.current?.focus();
    },
    [searchState.query, filterContext.prefixEnd],
  );

  const handleSelectFilterValue = useCallback(
    (filterValue: string) => {
      if (!filterContext.filterType) return;

      // Create the filter
      const newFilter: Filter = {
        id: createFilterId(),
        type: filterContext.filterType,
        value: filterValue,
        negated: false,
      };

      // Remove the @type:value part from query
      const newQuery = searchState.query
        .slice(0, filterContext.prefixEnd)
        .trimEnd();

      // Check if filter type allows multiple, if not replace existing
      const filterMeta = FILTER_TYPES[newFilter.type];
      let newFilters: Filter[];
      if (filterMeta.multiple) {
        newFilters = [...searchState.filters, newFilter];
      } else {
        newFilters = [
          ...searchState.filters.filter((f) => f.type !== newFilter.type),
          newFilter,
        ];
      }

      setSearchState({
        query: newQuery,
        filters: newFilters,
      });

      inputRef.current?.focus();
    },
    [searchState, filterContext],
  );

  const handleRemoveFilter = useCallback((id: string) => {
    setSearchState((prev) => ({
      ...prev,
      filters: prev.filters.filter((f) => f.id !== id),
    }));
    inputRef.current?.focus();
  }, []);

  // Handle backspace at start of input to remove last filter
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (
        e.key === "Backspace" &&
        searchState.filters.length > 0 &&
        inputRef.current?.selectionStart === 0 &&
        inputRef.current?.selectionEnd === 0
      ) {
        e.preventDefault();
        // Remove the last filter
        setSearchState((prev) => ({
          ...prev,
          filters: prev.filters.slice(0, -1),
        }));
      }
    },
    [searchState.filters.length],
  );

  const handleCloseDropdown = useCallback(() => {
    // Remove the incomplete filter syntax
    if (filterContext.prefixEnd > 0 || filterContext.mode !== "none") {
      const newQuery = searchState.query
        .slice(0, filterContext.prefixEnd)
        .trimEnd();
      setSearchState((prev) => ({ ...prev, query: newQuery }));
    }
  }, [searchState.query, filterContext.prefixEnd, filterContext.mode]);

  const handleAddDateFilter = useCallback(
    (filter: Filter, _displayValue: string) => {
      // Mark that we just applied a date filter so handleCloseDatePicker doesn't clear it
      dateFilterAppliedRef.current = true;

      // Remove the @date: part from query
      const newQuery = searchState.query
        .slice(0, filterContext.prefixEnd)
        .trimEnd();

      // Check if date filter type allows multiple (it doesn't)
      const newFilters = [
        ...searchState.filters.filter((f) => f.type !== "date"),
        filter,
      ];

      setSearchState({
        query: newQuery,
        filters: newFilters,
      });

      inputRef.current?.focus();
    },
    [searchState, filterContext.prefixEnd],
  );

  const handleCloseDatePicker = useCallback(
    (pickerOpen: boolean) => {
      if (!pickerOpen) {
        // If we just applied a date filter, don't clear anything
        if (dateFilterAppliedRef.current) {
          dateFilterAppliedRef.current = false;
          return;
        }
        // Otherwise, user cancelled - clear the @date: from the query
        const newQuery = searchState.query
          .slice(0, filterContext.prefixEnd)
          .trimEnd();
        setSearchState((prev) => ({ ...prev, query: newQuery }));
      }
    },
    [searchState.query, filterContext.prefixEnd],
  );

  // Theme handler
  const handleThemeChange = useCallback((theme: ThemePreference) => {
    applyThemePreference(theme);
    storeThemePreference(theme);
    setCurrentTheme(theme);
    setOpen(false);
  }, [setOpen]);

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
        setSearchState((prev) => ({ ...prev, query: "" }));
        setSelectedValue("theme-light");
        // Focus input after page change (clicking with mouse moves focus away)
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }
      if (value === "theme-back") {
        setPage("main");
        setSearchState((prev) => ({ ...prev, query: "" }));
        setSelectedValue(""); // Let cmdk auto-select first item
        requestAnimationFrame(() => inputRef.current?.focus());
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

  // Prevent dialog from closing when interacting with filter dropdown or date picker
  const handleInteractOutside = useCallback(
    (e: Event) => {
      if (filterDropdownOpen || datePickerOpen) {
        e.preventDefault();
      }
    },
    [filterDropdownOpen, datePickerOpen],
  );

  // Shared search group component used in both search-only view and main view
  const searchGroup = (
    <CommandGroup heading="Search" forceMount>
      <CommandItem
        value={`search-query-${searchState.query}-${searchState.filters.length}`}
        keywords={["search", "find", "search your abode", searchState.query]}
        onSelect={handleSearch}
        forceMount
      >
        <Search className="size-4" />
        <span>Search your abode for</span>
        <Badge>
          {searchState.query.trim() && searchState.filters.length > 0 ? (
            <>
              "{searchState.query.trim()}" with {searchState.filters.length}{" "}
              filter
              {searchState.filters.length !== 1 ? "s" : ""}
            </>
          ) : searchState.query.trim() ? (
            <>"{searchState.query.trim()}"</>
          ) : (
            <>
              {searchState.filters.length} filter
              {searchState.filters.length !== 1 ? "s" : ""}
            </>
          )}
        </Badge>
      </CommandItem>
    </CommandGroup>
  );

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Command Palette"
        description="Search for commands or items..."
        value={selectedValue}
        onValueChange={setSelectedValue}
        onInteractOutside={handleInteractOutside}
        onPointerDownOutside={handleInteractOutside}
      >
        <CommandInput
          ref={inputRef}
          placeholder={
            page === "theme" ? "Select theme..." : "Type a command or search..."
          }
          value={searchState.query}
          onValueChange={(query) =>
            setSearchState((prev) => ({ ...prev, query }))
          }
          onKeyDown={handleInputKeyDown}
        />

        {/* Filter chips (shown when filters are active) */}
        {searchState.filters.length > 0 && (
          <div className="border-b px-3 py-2">
            <FilterChips
              filters={searchState.filters}
              onRemove={handleRemoveFilter}
            />
          </div>
        )}

        <CommandList className="scroll-shadow-y max-h-[calc(100vh-8rem)]">
          {/* Only show empty state for unauthenticated users - authenticated users always have search */}
          {!isAuthenticated && <CommandEmpty>No results found.</CommandEmpty>}

          {page === "theme" ? (
            // Theme submenu
            <>
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
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  value="theme-back"
                  keywords={["back", "return", "go back"]}
                  onSelect={handleSelect}
                >
                  <ArrowLeft className="size-4" />
                  <span>Back</span>
                </CommandItem>
              </CommandGroup>
            </>
          ) : isAuthenticated && hasActiveFilters ? (
            // Search-only view (when filters are active)
            searchGroup
          ) : (
            // Main view (no active search)
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
                      <Handshake className="size-4" />
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
                  <span className="ml-auto text-muted-foreground text-xs">
                    {themeLabels[currentTheme]}
                  </span>
                </CommandItem>
              </CommandGroup>

              {/* Rooms (authenticated only) */}
              {isAuthenticated && profile?.username && rooms && rooms.length > 0 && (
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
                      <span className="ml-auto text-muted-foreground text-xs">
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

              {/* Search option (shown at bottom when there's query text) */}
              {isAuthenticated && hasQueryText && searchGroup}
            </>
          )}
        </CommandList>
      </CommandDialog>

      {/* Filter dropdown (for types and non-date values) */}
      <FilterDropdown
        open={filterDropdownOpen}
        onClose={handleCloseDropdown}
        mode={filterContext.mode === "types" ? "types" : "values"}
        currentFilterType={filterContext.filterType}
        searchText={filterContext.searchText}
        filterValues={filterValues}
        loadingValues={loadingValues}
        onSelectType={handleSelectFilterType}
        onSelectValue={handleSelectFilterValue}
        anchorRef={inputRef}
      />

      {/* Date range picker (shown when @date: is typed) */}
      <DateRangePicker
        open={datePickerOpen}
        onOpenChange={handleCloseDatePicker}
        onAddFilter={handleAddDateFilter}
        anchorRef={inputRef}
      />

      {/* Upload dialog - shared state */}
      <UploadDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen} />
    </>
  );
}
