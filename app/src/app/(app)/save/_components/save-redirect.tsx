"use client";

import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useEffect, useRef } from "react";
import { api } from "@/lib/api-client";
import { useInvalidateItems } from "@/lib/api-hooks";
import { createLogger } from "@/lib/logger.client";
import { ROUTES } from "@/lib/routes";
import { useMilestoneStore } from "@/stores/milestone-store";

const log = createLogger("save/save-redirect");

/**
 * Saves the shared URL exactly once, then redirects to the dashboard with a
 * toast (`?share=`). Renders nothing — the feedback is the toast, not a screen.
 *
 * The POST (rather than a GET-time server save) plus the ref guard keep a
 * prefetch/refresh of `/save` from creating duplicate items.
 */
export function SaveRedirect({ url }: { url: string }) {
  const router = useRouter();
  const invalidateItems = useInvalidateItems();
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current) return;
    submitted.current = true;

    void (async () => {
      try {
        await api.post("/api/v1/items/from-url", {
          url,
          source: "share_target",
        });
        useMilestoneStore.getState().markComplete("save_first_url");
        invalidateItems();
        router.replace(`${ROUTES.DASHBOARD}?share=saved`);
      } catch (error) {
        log.error({ error }, "Share target save failed");
        posthog.captureException(error);
        posthog.capture("share_target_failed", { reason: "save_error" });
        router.replace(`${ROUTES.DASHBOARD}?share=error`);
      }
    })();
  }, [url, router, invalidateItems]);

  return null;
}
