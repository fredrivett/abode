"use client";

import { useSearchParams } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
  readItemParam,
  withOpenItem,
  withoutOpenItem,
} from "@/lib/items/item-dialog-url";

type ItemDialogContextValue = {
  /** The item whose detail dialog the URL currently addresses, or null. */
  openItemId: string | null;
  /** Open an item's dialog, pushing a history entry (Back closes it). */
  openItem: (itemId: string) => void;
  /** Close the open dialog: pop history if we pushed, else strip the param. */
  closeItem: () => void;
  /**
   * Report the open item's live display name so the provider owns the tab
   * title. The open dialog reports it (fresh for any list it came from, and
   * updated on rename), tagged with the item id; the provider only applies a
   * report whose id matches the current open item, so a stale report can't win
   * and a transient dialog remount can't blank the title.
   */
  reportItemTitle: (report: { id: string; title: string } | null) => void;
};

const ItemDialogContext = createContext<ItemDialogContextValue | null>(null);

/**
 * Makes the open item-detail dialog URL-addressable (`?item=<id>`).
 *
 * A single subscriber to the search params lives here so the (potentially
 * hundreds of) grid cards don't each subscribe — they read the open item from
 * context and only re-render when it actually changes, not on every keystroke
 * the search writer pushes to the URL.
 *
 * Opening pushes a history entry so opening an item feels like navigating into
 * a sub-page: the Back button (and Esc/close, which pops that entry) returns to
 * the grid. A dialog present in the URL on load (refresh / deep link) has no
 * entry to pop, so closing strips the param in place instead of navigating away.
 */
export function ItemDialogProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const openItemId = readItemParam(searchParams);

  // Whether the current dialog was opened via pushState this session (vs.
  // present in the URL on load). Decides back() vs. in-place strip on close.
  const openedViaPushRef = useRef(false);

  const openItem = useCallback((itemId: string) => {
    openedViaPushRef.current = true;
    const query = withOpenItem(window.location.search, itemId);
    window.history.pushState(null, "", `?${query}`);
  }, []);

  const closeItem = useCallback(() => {
    if (openedViaPushRef.current) {
      openedViaPushRef.current = false;
      window.history.back();
      return;
    }
    // Cold load / deep link: no entry to pop, so strip the param in place and
    // stay on the dashboard rather than navigating out of the app.
    const query = withoutOpenItem(window.location.search);
    window.history.replaceState(
      null,
      "",
      query ? `?${query}` : window.location.pathname,
    );
  }, []);

  // The open item's display name, reported by the open dialog and tagged with
  // its id. Owned here (a stable component) rather than in the dialog so the tab
  // title survives the dialog's mount churn on cold load and stays fresh after a
  // rename. We derive the effective title during render and only apply a report
  // whose id matches the current open item — so there's no reset effect that
  // could race the dialog's (child-first) report, and a stale report is ignored
  // rather than blanking the title.
  const [reported, setReported] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const openItemTitle =
    openItemId && reported?.id === openItemId ? reported.title : null;

  useDocumentTitle(openItemTitle ? `${openItemTitle} | abode` : null);

  const value = useMemo(
    () => ({
      openItemId,
      openItem,
      closeItem,
      reportItemTitle: setReported,
    }),
    [openItemId, openItem, closeItem],
  );

  return (
    <ItemDialogContext.Provider value={value}>
      {children}
    </ItemDialogContext.Provider>
  );
}

/**
 * Access the item-dialog URL controller. Returns null outside a provider (e.g.
 * the room views), where callers fall back to local dialog state.
 */
export function useItemDialog(): ItemDialogContextValue | null {
  return useContext(ItemDialogContext);
}

/**
 * Open/close state for a single item's detail dialog.
 *
 * On the dashboard the dialog is URL-addressable via {@link ItemDialogProvider}
 * (so refresh and the Back button work); everywhere else (e.g. room views)
 * there's no provider and it falls back to local component state.
 */
export function useItemDetailDialog(itemId: string): {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
} {
  const itemDialog = useItemDialog();
  const [localOpen, setLocalOpen] = useState(false);

  const isOpen = itemDialog ? itemDialog.openItemId === itemId : localOpen;

  const setOpen = useCallback(
    (open: boolean) => {
      if (!itemDialog) {
        setLocalOpen(open);
        return;
      }
      if (open) itemDialog.openItem(itemId);
      else itemDialog.closeItem();
    },
    [itemDialog, itemId],
  );

  return { isOpen, setOpen };
}
