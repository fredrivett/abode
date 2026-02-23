"use client";

import { createContext, useCallback, useContext, useRef } from "react";

type HeadingIdContextType = {
  getOrCreateId: (instanceKey: string, baseId: string) => string;
};

const HeadingIdContext = createContext<HeadingIdContextType | null>(null);

/**
 * Provides context for generating stable, unique heading IDs within a document.
 *
 * Tracks which base IDs have been used and appends numeric suffixes for duplicates,
 * ensuring each heading instance gets a consistent ID across re-renders.
 */
export function HeadingIdProvider({ children }: { children: React.ReactNode }) {
  // Map of baseId -> count of how many times it's been used
  const idCounts = useRef<Map<string, number>>(new Map());
  // Map of instanceKey -> assigned id (to return same id for same component)
  const instanceIds = useRef<Map<string, string>>(new Map());

  const getOrCreateId = useCallback(
    (instanceKey: string, baseId: string): string => {
      // If this instance already has an id, return it
      const existingId = instanceIds.current.get(instanceKey);
      if (existingId !== undefined) {
        return existingId;
      }

      // Generate a new unique id
      const count = idCounts.current.get(baseId) ?? 0;
      idCounts.current.set(baseId, count + 1);

      const newId = count === 0 ? baseId : `${baseId}-${count}`;
      instanceIds.current.set(instanceKey, newId);

      return newId;
    },
    [],
  );

  return (
    <HeadingIdContext.Provider value={{ getOrCreateId }}>
      {children}
    </HeadingIdContext.Provider>
  );
}

/**
 * Returns the `getOrCreateId` function from the nearest `HeadingIdProvider`.
 *
 * @throws {Error} If called outside of a `HeadingIdProvider`.
 */
export function useHeadingId() {
  const context = useContext(HeadingIdContext);
  if (!context) {
    throw new Error("useHeadingId must be used within a HeadingIdProvider");
  }
  return context;
}
