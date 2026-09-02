"use client";

import { useEffect } from "react";

/**
 * Set `document.title` while the calling component is mounted, restoring the
 * previous title when it unmounts or the title changes. Handy for transient
 * surfaces (e.g. an open dialog) that should own the tab title only while shown.
 *
 * Pass `null` to not manage the title at all (leaving whatever is there),
 * letting a caller drive the tab title on/off from a single piece of state.
 */
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    if (title === null) return;
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
