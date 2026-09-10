"use client";

import { useEffect, useState } from "react";
import { useUpdateCachedItemTitle } from "@/lib/api-hooks";
import { getProxyImageUrl } from "@/lib/image-url";
import { getItemDisplayName } from "@/lib/items/item-display-name";
import type { Item } from "@/lib/types/item";
import { formatBytes, getFileSizeFromMeta } from "@/lib/utils";
import { ItemDetailDialogHost } from "../item-card";
import { useItemDialog } from "../item-dialog-context";

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
export function DashboardItemDialog({ items }: { items: Item[] }) {
  const itemDialog = useItemDialog();
  const openItemId = itemDialog?.openItemId ?? null;

  const resolved = openItemId
    ? (items.find((item) => item.id === openItemId) ?? null)
    : null;

  // Keep the last opened item mounted through the close animation, then clear
  // it on exit — otherwise closing would unmount instantly with no animation.
  const [rendered, setRendered] = useState<Item | null>(resolved);
  useEffect(() => {
    if (resolved) setRendered(resolved);
  }, [resolved]);

  if (!rendered) return null;

  return (
    <DashboardItemDialogContents
      item={rendered}
      open={openItemId === rendered.id}
      onClose={() => itemDialog?.closeItem()}
      onExitComplete={() => setRendered(null)}
    />
  );
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
