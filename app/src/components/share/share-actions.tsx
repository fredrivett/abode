"use client";

import { Check, X } from "lucide-react";
import posthog from "posthog-js";
import { type ReactNode, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { reportCopyFailure } from "@/hooks/use-copy-to-clipboard";
import { api } from "@/lib/api-client";
import { copyToClipboard } from "@/lib/copy";
import { createLogger } from "@/lib/logger.client";

const log = createLogger("share-actions");

const noopSubscribe = () => () => {};

// Server snapshot is false so SSR and hydration agree; the browser answers
// for real once mounted
export function useCanNativeShare() {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
}

type UseShareActionsOptions<M extends string> = {
  itemId: string;
  /** Whether the item already has link sharing on */
  isShared: boolean;
  /** Called once sharing has turned on the item's link sharing */
  onShared: () => void;
  /** What's being shared, for the item_share_toggled event */
  source: string;
  /** Toast shown when link sharing can't be turned on */
  sharingErrorMessage: string;
  /** Called once a share method has fully worked */
  onSuccess: (method: M | "native") => void;
};

/**
 * Copy / native-share actions for a link to something inside an item (a
 * highlight, a book review). The link only works while the item is shared, so
 * each action turns link sharing on first if it's off, and only reports
 * success once both have worked.
 */
export function useShareActions<M extends string>({
  itemId,
  isShared,
  onShared,
  source,
  sharingErrorMessage,
  onSuccess,
}: UseShareActionsOptions<M>) {
  type Method = M | "native";
  const [pending, setPending] = useState<Method | null>(null);
  const [copied, setCopied] = useState<Method | null>(null);
  const [failed, setFailed] = useState<Method | null>(null);

  const ensureShared = async (): Promise<boolean> => {
    if (isShared) return true;
    try {
      await api.patch(`/api/v1/items/${itemId}`, { shared: true });
      posthog.capture("item_share_toggled", {
        item_id: itemId,
        shared: true,
        source,
      });
      onShared();
      return true;
    } catch (error) {
      log.error({ error, source }, "Enable sharing error");
      toast.error(sharingErrorMessage);
      return false;
    }
  };

  // The action runs straight away, in parallel with enabling sharing: the
  // clipboard and share sheet need the click's user activation, which awaiting
  // the request first would spend (Safari rejects them outright)
  const run = async (
    method: Method,
    action: () => Promise<boolean>,
    success?: string,
  ) => {
    setPending(method);
    try {
      const sharing = ensureShared();
      const done = await action();
      // Only claim success once the link works too, i.e. sharing is on
      if (!(await sharing) || !done) return;
      if (success) toast.success(success);
      onSuccess(method);
      setCopied(method);
      setTimeout(() => setCopied((c) => (c === method ? null : c)), 2000);
    } finally {
      setPending(null);
    }
  };

  const copy = (method: M, text: string, success: string) =>
    run(
      method,
      async () => {
        const result = await copyToClipboard(text);
        if (!result.ok) {
          reportCopyFailure({
            reason: result.reason,
            message: "Failed to copy",
          });
          setFailed(method);
          setTimeout(() => setFailed((f) => (f === method ? null : f)), 2000);
        }
        return result.ok;
      },
      success,
    );

  const nativeShare = (data: ShareData) =>
    run("native", async () => {
      try {
        await navigator.share(data);
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

  return {
    pending,
    busy: pending !== null,
    /** The icon for a share button: a tick once it worked, a cross if it failed */
    methodIcon: (method: Method, idle: ReactNode) =>
      copied === method ? (
        <Check />
      ) : failed === method ? (
        <X className="text-destructive" />
      ) : (
        idle
      ),
    copy,
    nativeShare,
  };
}
