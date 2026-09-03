"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Fallback tab title when nothing was captured (e.g. refreshed with an item open). */
const APP_TITLE = "abode";

/**
 * Owns the browser tab title for the open item-detail dialog.
 *
 * The open dialog reports its live display name (fresh for any list it came
 * from, and updated on rename) via the returned callback, tagged with its id.
 * We keep the report keyed by id and derive the effective title during render —
 * applying only a report whose id matches the current open item — so there's no
 * reset effect to race the dialog's (child-first) report, and a stale report is
 * ignored rather than blanking the title.
 *
 * The title is set on open/rename and the base is restored on close. We capture
 * the base (as server-rendered, including any dev branch prefix) when the app
 * loads without an item open, and leave the server-rendered title untouched
 * until the first open — so the plain dashboard title is preserved, and on a
 * refresh the server already renders the item title (see the page's
 * generateMetadata) so setting the same value causes no flicker.
 */
export function useOpenItemTabTitle(
  openItemId: string | null,
): (report: { id: string; title: string }) => void {
  // Fresh open item id for the (stable) reportItemTitle callback to read.
  const openItemIdRef = useRef(openItemId);
  openItemIdRef.current = openItemId;

  const [reported, setReported] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Ignore a report for an item that isn't the one currently open (e.g. a dialog
  // mid-exit) so a stale report can't overwrite — and thus blank — the title.
  const reportItemTitle = useCallback(
    (report: { id: string; title: string }) => {
      if (report.id !== openItemIdRef.current) return;
      setReported(report);
    },
    [],
  );

  const openItemTitle =
    openItemId && reported?.id === openItemId ? reported.title : null;

  // Remember the base title to restore verbatim on close. Only meaningful when
  // we loaded without an item open; a refresh with an item open never sees the
  // base, so it falls back to the app name.
  const baseTitleRef = useRef<string | null>(null);
  useEffect(() => {
    if (baseTitleRef.current === null && !openItemIdRef.current) {
      baseTitleRef.current = document.title;
    }
  }, []);

  // Own the title once an item has been opened; leave it alone before that.
  const hasManagedTitleRef = useRef(false);
  useEffect(() => {
    if (openItemTitle) {
      hasManagedTitleRef.current = true;
      document.title = `${openItemTitle} | ${APP_TITLE}`;
    } else if (hasManagedTitleRef.current) {
      document.title = baseTitleRef.current ?? APP_TITLE;
    }
  }, [openItemTitle]);

  return reportItemTitle;
}
