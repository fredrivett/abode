"use client";

import { createContext, useContext, useRef, useCallback } from "react";

type HeadingIdContextType = {
  getOrCreateId: (instanceKey: string, baseId: string) => string;
};

const HeadingIdContext = createContext<HeadingIdContextType | null>(null);

export function HeadingIdProvider({ children }: { children: React.ReactNode }) {
  // Map of baseId -> count of how many times it's been used
  const idCounts = useRef<Map<string, number>>(new Map());
  // Map of instanceKey -> assigned id (to return same id for same component)
  const instanceIds = useRef<Map<string, string>>(new Map());

  const getOrCreateId = useCallback((instanceKey: string, baseId: string): string => {
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
  }, []);

  return (
    <HeadingIdContext.Provider value={{ getOrCreateId }}>
      {children}
    </HeadingIdContext.Provider>
  );
}

export function useHeadingId() {
  const context = useContext(HeadingIdContext);
  if (!context) {
    throw new Error("useHeadingId must be used within a HeadingIdProvider");
  }
  return context;
}
