"use client";

import { Link2, Quote, Share } from "lucide-react";
import posthog from "posthog-js";
import {
  useCanNativeShare,
  useShareActions,
} from "@/components/share/share-actions";
import {
  SHARE_CARD_DOM_FONTS,
  ShareCardLogo,
  ShareCardPreview,
} from "@/components/share/share-card-preview";
import { ShareInvitesNote } from "@/components/share/share-invites-note";
import { Button } from "@/components/ui/button";
import {
  DialogOrDrawer,
  DialogOrDrawerBody,
  DialogOrDrawerContent,
  DialogOrDrawerDescription,
  DialogOrDrawerHeader,
  DialogOrDrawerTitle,
} from "@/components/ui/dialog-or-drawer";
import { IsLoading } from "@/components/ui/is-loading";
import {
  formatHighlightQuote,
  highlightShareUrl,
  type ShareableHighlight,
} from "@/lib/highlights/share";
import {
  HIGHLIGHT_CARD_SIZE,
  HighlightShareCard,
  type HighlightShareCardProps,
} from "./highlight-share-card";

type ShareHighlightDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  highlight: ShareableHighlight | null;
  item: { id: string; title: string | null; domain: string | null };
  username: string;
  /** Whether the item already has link sharing on */
  isShared: boolean;
  /** Called once sharing the highlight has turned on the item's link sharing */
  onShared: () => void;
};

/** The highlight's share card, scaled down to the available width. */
export function HighlightCardPreview(
  props: Omit<HighlightShareCardProps, "fonts" | "logo">,
) {
  return (
    <ShareCardPreview size={HIGHLIGHT_CARD_SIZE}>
      <HighlightShareCard
        {...props}
        fonts={SHARE_CARD_DOM_FONTS}
        logo={<ShareCardLogo />}
      />
    </ShareCardPreview>
  );
}

/**
 * Preview-and-share for a single highlight: shows the card the link unfurls
 * to, and copies the link (or the quote) or hands it to the native share sheet.
 * Sharing turns on the article's link sharing if it isn't already on, so the
 * dialog says so before anything is copied.
 */
export function ShareHighlightDialog({
  open,
  onOpenChange,
  highlight,
  item,
  username,
  isShared,
  onShared,
}: ShareHighlightDialogProps) {
  const canNativeShare = useCanNativeShare();
  const { busy, pending, methodIcon, copy, nativeShare } = useShareActions<
    "copy_link" | "copy_quote"
  >({
    itemId: item.id,
    isShared,
    onShared,
    source: "highlight",
    sharingErrorMessage: "Couldn't turn on sharing for this article",
    onSuccess: (method) => {
      if (!highlight) return;
      posthog.capture("highlight_shared", {
        item_id: item.id,
        highlight_id: highlight.id,
        method,
      });
    },
  });

  if (!highlight) return null;

  const url = highlightShareUrl({
    username,
    itemId: item.id,
    highlightId: highlight.id,
  });
  const quote = formatHighlightQuote({
    text: highlight.text,
    title: item.title,
    url,
  });

  return (
    <DialogOrDrawer open={open} onOpenChange={onOpenChange}>
      <DialogOrDrawerContent
        className="sm:max-w-xl"
        // Radix focuses the first button on open, so Copy link would open
        // wearing its focus ring; focus the dialog itself instead, so screen
        // readers land in it and Tab moves to the first action
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          if (e.currentTarget instanceof HTMLElement) e.currentTarget.focus();
        }}
      >
        <DialogOrDrawerHeader>
          <DialogOrDrawerTitle>Share highlight</DialogOrDrawerTitle>
          <DialogOrDrawerDescription>
            This is how your link will look when you share it.
          </DialogOrDrawerDescription>
        </DialogOrDrawerHeader>

        <DialogOrDrawerBody className="space-y-5">
          <HighlightCardPreview
            text={highlight.text}
            title={item.title}
            domain={item.domain}
            ownerUsername={username}
          />

          <p className="text-muted-foreground text-xs">
            {isShared
              ? "Anyone with the link can see this highlight and read the article."
              : "Sharing turns on link sharing for this article, so anyone with the link can read it. Your other highlights stay private."}
          </p>

          <ShareInvitesNote enabled={open} />

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="secondary"
              // The light theme's secondary is near-white; a firmer grey keeps
              // the main action standing out from the outlined ones
              className="bg-gray-200 hover:bg-gray-300 sm:flex-1 dark:bg-secondary dark:hover:bg-secondary/80"
              disabled={busy}
              onClick={() => void copy("copy_link", url, "Link copied")}
            >
              {pending === "copy_link" ? (
                <IsLoading label="Sharing" />
              ) : (
                <>
                  {methodIcon("copy_link", <Link2 />)}
                  Copy link
                </>
              )}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void copy("copy_quote", quote, "Quote copied")}
            >
              {methodIcon("copy_quote", <Quote />)}
              Copy quote
            </Button>
            {canNativeShare && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  // The link goes in `url` only; repeating it in `text` makes
                  // some targets show it twice
                  void nativeShare({
                    title: item.title ?? undefined,
                    text: formatHighlightQuote({
                      text: highlight.text,
                      title: item.title,
                    }),
                    url,
                  })
                }
              >
                <Share />
                Share…
              </Button>
            )}
          </div>
        </DialogOrDrawerBody>
      </DialogOrDrawerContent>
    </DialogOrDrawer>
  );
}
