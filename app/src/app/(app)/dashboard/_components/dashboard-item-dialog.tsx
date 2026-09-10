"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useUpdateCachedItemTitle } from "@/lib/api-hooks";
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
}: {
  items: Item[];
  /** Full item for the URL's open item at initial load (deep link / refresh),
   *  so a deep-linked off-grid item renders instantly without a fetch. */
  initialItem?: Item | null;
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

  // Keep the last opened item mounted through the close animation, then clear
  // it on exit — otherwise closing would unmount instantly with no animation.
  const [rendered, setRendered] = useState<Item | null>(resolved);
  useEffect(() => {
    if (resolved) setRendered(resolved);
  }, [resolved]);

  if (rendered) {
    return (
      // Key by id so swapping to another item in place (a similar-images click
      // while open) remounts the dialog — its many item-scoped useState inits
      // (cover/share/notes/tags…) would otherwise keep the previous item's
      // values and PATCH the new item with the wrong ones.
      <DashboardItemDialogContents
        key={rendered.id}
        item={rendered}
        open={openItemId === rendered.id}
        onClose={() => itemDialog?.closeItem()}
        onExitComplete={() => setRendered(null)}
      />
    );
  }

  // Still fetching an off-grid item — show the seed image/title while it loads.
  if (openItemId && seed && seed.id === openItemId) {
    return (
      <ItemDialogSkeleton seed={seed} onClose={() => itemDialog?.closeItem()} />
    );
  }

  return null;
}

function DashboardItemDialogContents({
  item,
  open,
  onClose,
  onExitComplete,
}: {
  item: Item;
  open: boolean;
  onClose: () => void;
  onExitComplete: () => void;
}) {
  const updateCachedTitle = useUpdateCachedItemTitle();
  const displayName = getItemDisplayName(item);
  // Local mirror so a rename shows in the dialog immediately; the cache patch
  // below keeps the grid tile in sync, and re-derives displayName on the next render.
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
        updateCachedTitle(item.id, next);
      }}
      canEdit
      onExitComplete={onExitComplete}
    />
  );
}
