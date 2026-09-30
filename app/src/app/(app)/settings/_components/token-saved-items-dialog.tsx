"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IsLoading } from "@/components/ui/is-loading";
import { ITEM_KIND_LABELS } from "@/lib/item-kind-reassignment";
import type {
  TokenSavedItem,
  TokenSavedItemsPage,
} from "@/lib/personal-access-tokens";

type TokenSavedItemsDialogProps = {
  token: { id: string; name: string; itemCount: number } | null;
  onClose: () => void;
};

async function fetchSavedItems(
  tokenId: string,
  cursor: string | null,
): Promise<TokenSavedItemsPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const response = await fetch(`/api/v1/tokens/${tokenId}/items${query}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// A token save has no title until processing finishes (and notes may never get one)
function itemLabel(item: TokenSavedItem): string {
  if (item.title) return item.title;
  if (item.sourceUrl) {
    try {
      return new URL(item.sourceUrl).hostname;
    } catch {
      return item.sourceUrl;
    }
  }
  return "Untitled";
}

/**
 * Lists the items one personal access token saved, newest first, a page at a
 * time — so a user can see (and open) everything a script or a leaked token
 * added. Each row opens the item on the dashboard.
 */
export function TokenSavedItemsDialog({
  token,
  onClose,
}: TokenSavedItemsDialogProps) {
  const [items, setItems] = useState<TokenSavedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  // Bumped on every open (and close), so a response from an earlier open —
  // even of the same token — can't land in this one
  const openGeneration = useRef(0);

  const tokenId = token?.id ?? null;

  const loadPage = async (id: string, cursor: string | null) => {
    const generation = openGeneration.current;
    const isCurrent = () => openGeneration.current === generation;
    setIsLoading(true);
    setError(false);
    try {
      const page = await fetchSavedItems(id, cursor);
      if (!isCurrent()) return;
      setItems((prev) => (cursor ? [...prev, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
    } catch {
      if (isCurrent()) setError(true);
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  };

  // Reads the latest loadPage without making it an effect dependency
  const openFor = useEffectEvent((id: string | null) => {
    openGeneration.current += 1;
    setItems([]);
    setNextCursor(null);
    setError(false);
    setIsLoading(false);
    if (id) void loadPage(id, null);
  });

  // Fresh first page each time the dialog opens for a token
  useEffect(() => openFor(tokenId), [tokenId]);

  return (
    <Dialog open={token !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Saved by {token?.name}</DialogTitle>
          <DialogDescription>
            {token?.itemCount === 1
              ? "The 1 item saved with this token."
              : `The ${token?.itemCount ?? 0} items saved with this token, newest first.`}{" "}
            Revoking the token doesn't remove them.
          </DialogDescription>
        </DialogHeader>

        {items.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/dashboard?item=${item.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-secondary"
                >
                  <span className="min-w-0 truncate">{itemLabel(item)}</span>
                  <span className="shrink-0 text-muted-foreground text-xs">
                    {item.kind ? `${ITEM_KIND_LABELS[item.kind]} · ` : ""}
                    {formatDistanceToNow(new Date(item.addedAt), {
                      addSuffix: true,
                    })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {!isLoading && !error && items.length === 0 && (
          <p className="rounded-lg border py-4 text-center text-muted-foreground text-sm">
            Nothing saved with this token yet
          </p>
        )}

        {error && (
          <p className="text-center text-destructive text-sm">
            Couldn't load the items. Try again.
          </p>
        )}

        {isLoading ? (
          <div className="flex justify-center py-2 text-muted-foreground text-sm">
            <IsLoading label="Loading" />
          </div>
        ) : (
          tokenId &&
          (nextCursor || error) && (
            <Button
              type="button"
              variant="outline"
              // Retries the page that failed: the next one, or the first
              onClick={() => void loadPage(tokenId, nextCursor)}
            >
              {error ? "Retry" : "Load more"}
            </Button>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
