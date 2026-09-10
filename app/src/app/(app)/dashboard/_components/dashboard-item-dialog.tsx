"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getProxyImageUrl } from "@/lib/image-url";
import { getItemDisplayName } from "@/lib/items/item-display-name";
import { useItem } from "@/lib/items/use-item";
import type { Item } from "@/lib/types/item";
import { formatBytes, getFileSizeFromMeta } from "@/lib/utils";
import { ItemDetailDialogHost } from "../item-card";
import { useItemDialog } from "../item-dialog-context";
import { ItemDialogSkeleton } from "./item-dialog-skeleton";

/** For articles/webpages/products/books the cover is the display image; images use their own file. */
function detailImageFileKey(item: Item): string | null {
  const usesCover =
    item.kind === "article" ||
    item.kind === "webpage" ||
    item.kind === "product" ||
    item.kind === "book";
  return usesCover ? item.coverFileKey : item.fileKey;
}

/**
 * The single detail dialog for the dashboard. Driven by the URL-addressable
 * open item (`?item=<id>`) via {@link useItemDialog}, so it renders the dialog
 * for whichever item is open — including one that isn't in the loaded grid
 * (e.g. a "similar images" click to a filtered-out item). The grid cards on
 * the dashboard no longer render their own dialog; they just set the open item.
 */
export function DashboardItemDialog({
  items,
  initialItem,
  onItemRenamed,
}: {
  items: Item[];
  /** Full item for the URL's open item at initial load (deep link / refresh),
   *  so a deep-linked off-grid item renders instantly without a fetch. */
  initialItem?: Item | null;
  /** Propagate a rename to every list holding the item (React Query caches +
   *  local search-results state), so the grid card updates instantly. */
  onItemRenamed: (itemId: string, title: string) => void;
}) {
  const itemDialog = useItemDialog();
  const openItemId = itemDialog?.openItemId ?? null;
  const seed = itemDialog?.openItemSeed ?? null;

  // Resolve the open item: from the loaded list, the SSR deep-link item, or —
  // for an item outside all of those (a "similar images" click to a filtered-
  // out item) — a by-id fetch.
  const inList = openItemId
    ? (items.find((item) => item.id === openItemId) ?? null)
    : null;
  const fromInitial =
    initialItem && initialItem.id === openItemId ? initialItem : null;
  const needsFetch = openItemId !== null && !inList && !fromInitial;
  const { data: fetched, isError } = useItem(openItemId, needsFetch);
  const resolved =
    inList ??
    fromInitial ??
    (fetched && fetched.id === openItemId ? fetched : null);

  // The by-id fetch failed (deleted item, network) — close rather than sit on
  // the loading skeleton forever.
  const closeItem = itemDialog?.closeItem;
  useEffect(() => {
    if (needsFetch && isError) {
      toast.error("Couldn't open that item");
      closeItem?.();
    }
  }, [needsFetch, isError, closeItem]);

  const open = openItemId !== null;

  // Fresh open (grid → dialog) animates in; swapping straight from one open
  // item to another (a "similar images" click) changes instantly — so the
  // dialog only fades on open/close, not between items. Frozen per shown item
  // id so it stays stable across re-renders of the same item.
  const shownId = open ? (resolved?.id ?? null) : null;
  const prevShownIdRef = useRef<string | null>(null);
  const animateEntranceRef = useRef(true);
  if (shownId !== prevShownIdRef.current) {
    animateEntranceRef.current = prevShownIdRef.current === null;
    prevShownIdRef.current = shownId;
  }
  const animateEntrance = animateEntranceRef.current;

  // Keep the last shown item mounted through the close animation, then clear it
  // on exit — otherwise closing would unmount instantly with no animation.
  const [lastShown, setLastShown] = useState<Item | null>(null);
  useEffect(() => {
    if (resolved) setLastShown(resolved);
  }, [resolved]);

  if (open) {
    // Key by id so an in-place swap remounts the dialog: its many item-scoped
    // useState inits (cover/share/notes/tags…) would otherwise carry the
    // previous item's values and PATCH the new item with the wrong ones.
    if (resolved) {
      return (
        <DashboardItemDialogContents
          key={resolved.id}
          item={resolved}
          open
          animateEntrance={animateEntrance}
          onClose={() => closeItem?.()}
          onItemRenamed={onItemRenamed}
        />
      );
    }
    // Off-grid item still fetching — show the seed image/title meanwhile.
    if (seed && seed.id === openItemId) {
      return <ItemDialogSkeleton seed={seed} onClose={() => closeItem?.()} />;
    }
    return null;
  }

  // Closing: keep the last item mounted so it animates out, then clear it.
  if (lastShown) {
    return (
      <DashboardItemDialogContents
        key={lastShown.id}
        item={lastShown}
        open={false}
        animateEntrance={false}
        onClose={() => closeItem?.()}
        onExitComplete={() => setLastShown(null)}
        onItemRenamed={onItemRenamed}
      />
    );
  }

  return null;
}

function DashboardItemDialogContents({
  item,
  open,
  animateEntrance,
  onClose,
  onExitComplete,
  onItemRenamed,
}: {
  item: Item;
  open: boolean;
  animateEntrance: boolean;
  onClose: () => void;
  onExitComplete?: () => void;
  onItemRenamed: (itemId: string, title: string) => void;
}) {
  const displayName = getItemDisplayName(item);
  // Local mirror so a rename shows in the dialog immediately; onItemRenamed
  // keeps the grid card in sync, and displayName re-derives on the next render.
  const [name, setName] = useState(displayName);
  useEffect(() => setName(displayName), [displayName]);

  const imageFileKey = detailImageFileKey(item);
  const previewUrl = imageFileKey
    ? getProxyImageUrl(imageFileKey, "grid")
    : null;

  return (
    <ItemDetailDialogHost
      item={item}
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size={formatBytes(getFileSizeFromMeta(item.meta))}
      previewUrl={previewUrl}
      imageFileKey={imageFileKey}
      name={name}
      onNameChange={(next) => {
        setName(next);
        onItemRenamed(item.id, next);
      }}
      canEdit
      animateEntrance={animateEntrance}
      onExitComplete={onExitComplete}
    />
  );
}
