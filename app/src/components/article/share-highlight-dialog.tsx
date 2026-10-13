"use client";

import { Check, Link2, Quote, Share } from "lucide-react";
import posthog from "posthog-js";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { AbodeLogo } from "@/components/abode-logo";
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
import { api } from "@/lib/api-client";
import { copyToClipboard } from "@/lib/copy";
import {
  formatHighlightQuote,
  highlightShareUrl,
  type ShareableHighlight,
} from "@/lib/highlights/share";
import { createLogger } from "@/lib/logger.client";
import { OG_COLORS } from "@/lib/og/theme";
import {
  HIGHLIGHT_CARD_SIZE,
  HighlightShareCard,
  type HighlightShareCardProps,
} from "./highlight-share-card";

const log = createLogger("share-highlight-dialog");

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

type ShareMethod = "copy_link" | "copy_quote" | "native";

const noopSubscribe = () => () => {};

// Server snapshot is false so SSR and hydration agree; the browser answers
// for real once mounted
function useCanNativeShare() {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
}

const LOGO_HEIGHT = 30;

/**
 * Renders the 1200x630 share card scaled down to the available width, so the
 * preview is pixel-for-pixel the image a chat app unfurls for the link.
 */
export function HighlightCardPreview(
  props: Omit<HighlightShareCardProps, "fonts" | "logo">,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  const scale = width / HIGHLIGHT_CARD_SIZE.width;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10"
      style={{
        aspectRatio: `${HIGHLIGHT_CARD_SIZE.width} / ${HIGHLIGHT_CARD_SIZE.height}`,
        backgroundColor: OG_COLORS.bg,
      }}
    >
      {width > 0 && (
        <div
          aria-hidden
          className="absolute top-0 left-0 origin-top-left"
          style={{ transform: `scale(${scale})` }}
        >
          <HighlightShareCard
            {...props}
            fonts={{
              serif: "var(--font-hedvig-serif, serif)",
              sans: "var(--font-geist-sans, sans-serif)",
            }}
            logo={
              <AbodeLogo
                aria-hidden
                height={LOGO_HEIGHT}
                width={(LOGO_HEIGHT * 158) / 50}
                style={{ color: OG_COLORS.fg }}
              />
            }
          />
        </div>
      )}
    </div>
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
  const [pending, setPending] = useState<ShareMethod | null>(null);
  const [copied, setCopied] = useState<ShareMethod | null>(null);

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

  const ensureShared = async (): Promise<boolean> => {
    if (isShared) return true;
    try {
      await api.patch(`/api/v1/items/${item.id}`, { shared: true });
      posthog.capture("item_share_toggled", {
        item_id: item.id,
        shared: true,
        source: "highlight",
      });
      onShared();
      return true;
    } catch (error) {
      log.error({ error }, "Enable sharing for highlight error");
      toast.error("Couldn't turn on sharing for this article");
      return false;
    }
  };

  const track = (method: ShareMethod) =>
    posthog.capture("highlight_shared", {
      item_id: item.id,
      highlight_id: highlight.id,
      method,
    });

  // The action runs straight away, in parallel with enabling sharing: the
  // clipboard and share sheet need the click's user activation, which awaiting
  // the request first would spend (Safari rejects them outright)
  const run = async (method: ShareMethod, action: () => Promise<boolean>) => {
    setPending(method);
    try {
      const sharing = ensureShared();
      const done = await action();
      if (!(await sharing) || !done) return;
      track(method);
      setCopied(method);
      setTimeout(() => setCopied((c) => (c === method ? null : c)), 2000);
    } finally {
      setPending(null);
    }
  };

  const copy = (method: ShareMethod, text: string, success: string) =>
    run(method, async () => {
      const ok = await copyToClipboard(text);
      if (ok) toast.success(success);
      else toast.error("Failed to copy");
      return ok;
    });

  const nativeShare = () =>
    run("native", async () => {
      try {
        // The link goes in `url` only; repeating it in `text` makes some
        // targets show it twice
        await navigator.share({
          title: item.title ?? undefined,
          text: formatHighlightQuote({
            text: highlight.text,
            title: item.title,
          }),
          url,
        });
        return true;
      } catch (error) {
        // Dismissing the share sheet rejects with AbortError — not a failure
        if (error instanceof DOMException && error.name === "AbortError") {
          return false;
        }
        log.error({ error }, "Native share error");
        toast.error("Couldn't open the share sheet");
        return false;
      }
    });

  const busy = pending !== null;

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
                  {copied === "copy_link" ? <Check /> : <Link2 />}
                  Copy link
                </>
              )}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void copy("copy_quote", quote, "Quote copied")}
            >
              {copied === "copy_quote" ? <Check /> : <Quote />}
              Copy quote
            </Button>
            {canNativeShare && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void nativeShare()}
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
