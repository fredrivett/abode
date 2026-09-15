"use client";

import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getProxyImageUrl } from "@/lib/image-url";
import { getItemDisplayName } from "@/lib/items/item-display-name";
import { useItem } from "@/lib/items/use-item";
import type { Item } from "@/lib/types/item";
import { formatBytes, getFileSizeFromMeta } from "@/lib/utils";
import { ItemDetailBody, ItemDialogFrame } from "../item-card";
import { useItemDialog } from "../item-dialog-context";
import { ItemDialogSkeletonBody } from "./item-dialog-skeleton";

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
 * The single detail dialog for a grid of items (the dashboard or a room),
 * driven by the URL-addressable open item (`?item=<id>`) via {@link
 * useItemDialog}. One {@link ItemDialogFrame} stays mounted while an item is
 * open; its body swaps between the resolved item and the loading skeleton (for
 * an off-grid item still being fetched) without tearing down the dialog. Cards
 * don't render their own dialog inside a provider; they just set the open item.
 *
 * Mount this once inside an {@link ItemDialogProvider}, alongside the grid.
 */
export function CentralItemDialog({
  items,
  initialItem,
  canEdit,
  onItemRenamed,
  onItemDeleted,
}: {
  items: Item[];
  /** Full item for the URL's open item at initial load (deep link / refresh),
   *  so a deep-linked off-grid item renders instantly without a fetch. */
  initialItem?: Item | null;
  /** Whether the viewer can edit — false in a room viewed by a non-owner. */
  canEdit: boolean;
  /** Propagate a rename to whichever list holds the item (React Query caches,
   *  search-results state, or a room's local items) so the card updates. */
  onItemRenamed: (itemId: string, title: string) => void;
  /** Remove a deleted item from a caller-owned list. The dashboard omits this
   *  (its React Query list is invalidated on delete); a room passes it to drop
   *  the item from its local state, which no invalidation would reach. */
  onItemDeleted?: (itemId: string) => void;
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
  // The by-id endpoint is owner-scoped, so only the owner can resolve an item
  // that isn't already in the list; a non-owner's off-grid open (e.g. a
  // deep-linked room item beyond page one) can't be fetched, so don't try.
  const needsFetch = openItemId !== null && !inList && !fromInitial && canEdit;
  const { data: fetched, isError } = useItem(openItemId, needsFetch);
  const resolved =
    inList ??
    fromInitial ??
    (fetched && fetched.id === openItemId ? fetched : null);

  // The by-id fetch failed (deleted item, network, or not the viewer's to see)
  // — close rather than sit on the loading skeleton forever.
  const closeItem = itemDialog?.closeItem;
  useEffect(() => {
    if (needsFetch && isError) {
      toast.error("Couldn't open that item");
      closeItem?.();
    }
  }, [needsFetch, isError, closeItem]);

  const open = openItemId !== null;

  // Fresh open (grid → dialog) animates the frame in; swapping straight from one
  // open item to another (a "similar images" click) keeps the frame mounted and
  // just swaps the body, so the dialog only fades on open/close, not between
  // items. Keyed off openItemId (not resolved.id) so an off-grid swap's loading
  // gap — where resolved is briefly null — doesn't read as a close→open.
  const shownId = open ? openItemId : null;
  const prevShownIdRef = useRef<string | null>(null);
  const animateEntranceRef = useRef(true);
  if (shownId !== prevShownIdRef.current) {
    animateEntranceRef.current = prevShownIdRef.current === null;
    prevShownIdRef.current = shownId;
  }
  const animateEntrance = animateEntranceRef.current;

  return (
    <AnimatePresence>
      {open && (
        <ItemDialogFrame
          open
          onOpenChange={(next) => {
            if (!next) closeItem?.();
          }}
        >
          {resolved ? (
            // Key by id so an in-place swap resets the body's many item-scoped
            // useState inits (cover/share/notes/tags…), without remounting the
            // frame around it.
            <CentralItemBody
              key={resolved.id}
              item={resolved}
              canEdit={canEdit}
              animateEntrance={animateEntrance}
              onClose={() => closeItem?.()}
              onItemRenamed={onItemRenamed}
              onItemDeleted={onItemDeleted}
            />
          ) : seed && seed.id === openItemId ? (
            // Off-grid item still fetching — show the seed image/title meanwhile.
            <ItemDialogSkeletonBody seed={seed} />
          ) : null}
        </ItemDialogFrame>
      )}
    </AnimatePresence>
  );
}

function CentralItemBody({
  item,
  canEdit,
  animateEntrance,
  onClose,
  onItemRenamed,
  onItemDeleted,
}: {
  item: Item;
  canEdit: boolean;
  animateEntrance: boolean;
  onClose: () => void;
  onItemRenamed: (itemId: string, title: string) => void;
  onItemDeleted?: (itemId: string) => void;
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
    <ItemDetailBody
      item={item}
      open
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
      canEdit={canEdit}
      animateEntrance={animateEntrance}
      onDeleted={onItemDeleted ? () => onItemDeleted(item.id) : undefined}
    />
  );
}
