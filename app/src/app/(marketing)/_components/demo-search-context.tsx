"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

type DemoSearchValue = {
  /**
   * Cards the demo query is surfacing: null = no active query (gallery neutral);
   * [] = a value is being typed but nothing matches yet (fade everything);
   * [ids] = these cards match (brighten), the rest fade.
   */
  activeMatchIds: string[] | null;
  setActiveMatchIds: (ids: string[] | null) => void;
};

// Default is a no-op so consumers rendered without a provider (stories, tests)
// don't throw — the linkage just stays inert.
const DemoSearchContext = createContext<DemoSearchValue>({
  activeMatchIds: null,
  setActiveMatchIds: () => {},
});

// Shares the active demo search across the hero (SearchDemo, which drives it)
// and the gallery (LivingGallery, which reacts by highlighting the matches).
export function DemoSearchProvider({ children }: { children: ReactNode }) {
  const [activeMatchIds, setActiveMatchIds] = useState<string[] | null>(null);
  const value = useMemo(
    () => ({ activeMatchIds, setActiveMatchIds }),
    [activeMatchIds],
  );
  return (
    <DemoSearchContext.Provider value={value}>
      {children}
    </DemoSearchContext.Provider>
  );
}

export function useDemoSearch() {
  return useContext(DemoSearchContext);
}
