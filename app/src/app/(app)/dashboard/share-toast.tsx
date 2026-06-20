"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const SHARE_MESSAGES = {
  saved: { kind: "success", text: "Saved to abode — processing in background" },
  no_link: { kind: "error", text: "Couldn't read a link from what you shared" },
  error: { kind: "error", text: "Couldn't save that link — please try again" },
} as const;

/**
 * Shows a toast for the outcome of a share-target save (set by `/save` via
 * `?share=`), then strips the param so a refresh doesn't re-fire it.
 */
export function ShareToast({ share }: { share?: string }) {
  const pathname = usePathname();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current || !share) return;
    const message = SHARE_MESSAGES[share as keyof typeof SHARE_MESSAGES];
    if (!message) return;

    shown.current = true;
    // Defer a tick: on a full-page load (the no-link redirect) the root
    // Toaster subscribes after this child effect runs, so a synchronous toast
    // would be published before anything is listening and dropped.
    setTimeout(() => {
      if (message.kind === "success") {
        toast.success(message.text);
      } else {
        toast.error(message.text);
      }
    }, 0);
    // Strip ?share= without a re-render so a refresh can't re-fire the toast.
    window.history.replaceState(null, "", pathname);
  }, [share, pathname]);

  return null;
}
