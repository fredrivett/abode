"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { APP_NAME } from "@/lib/app";
import { branchTitlePrefix } from "@/lib/branch-title";

/**
 * Owns the browser tab title for the open item-detail dialog.
 *
 * The open dialog reports its live name (via the returned callback) tagged with
 * its id; we key the report by id and derive the title during render, so a stale
 * report can't blank it and no reset effect races the report. The title is set
 * on open/rename and the captured base restored on close; before the first open
 * the server title is left untouched (the page's generateMetadata already
 * renders the item title, so a refresh doesn't flicker).
 */
export function useOpenItemTabTitle(
  openItemId: string | null,
): (report: { id: string; title: string }) => void {
  const [reported, setReported] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Ignore a report for an item that isn't the one currently open (e.g. a dialog
  // mid-exit) so a stale report can't overwrite — and thus blank — the title.
  // Keyed on openItemId (not a ref) so the callback identity changes when the
  // open item does, letting a card's report effect re-run as the URL opens it.
  const reportItemTitle = useCallback(
    (report: { id: string; title: string }) => {
      if (report.id !== openItemId) return;
      setReported(report);
    },
    [openItemId],
  );

  const openItemTitle =
    openItemId && reported?.id === openItemId ? reported.title : null;

  // Remember the base title to restore verbatim on close. Only meaningful when
  // we loaded without an item open; a refresh with an item open never sees the
  // base, so it falls back to the app name. Captured from the mount-time id.
  const loadedWithItemOpenRef = useRef(openItemId !== null);
  const baseTitleRef = useRef<string | null>(null);
  useEffect(() => {
    if (baseTitleRef.current === null && !loadedWithItemOpenRef.current) {
      baseTitleRef.current = document.title;
    }
  }, []);

  // Own the title once an item has been opened; leave it alone before that.
  const hasManagedTitleRef = useRef(false);
  useEffect(() => {
    if (openItemTitle) {
      hasManagedTitleRef.current = true;
      // Mirror the root metadata template so a client-set title matches the
      // server-rendered one (dev branch prefix included).
      document.title = `${branchTitlePrefix()}${openItemTitle} | ${APP_NAME}`;
    } else if (hasManagedTitleRef.current) {
      document.title =
        baseTitleRef.current ?? `${branchTitlePrefix()}${APP_NAME}`;
    }
  }, [openItemTitle]);

  return reportItemTitle;
}
