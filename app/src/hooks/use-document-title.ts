"use client";

import { useEffect } from "react";

/**
 * Set `document.title` while the calling component is mounted, restoring the
 * previous title when it unmounts or the title changes. Handy for transient
 * surfaces (e.g. an open dialog) that should own the tab title only while shown.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
