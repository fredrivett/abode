"use client";

import { usePathname, useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { ApiClientError, api, isDailyLimitError } from "@/lib/api-client";
import { useInvalidateItems } from "@/lib/api-hooks";
import type { CreateDocumentBody } from "@/lib/documents/create-document-schema";
import { getImagePreview } from "@/lib/image-preview";
import { createLogger } from "@/lib/logger.client";
import type { FinishedScanPage } from "@/lib/scanner/pages";
import { createClient } from "@/lib/supabase/client";
import { DAILY_LIMIT_REACHED_MESSAGE } from "@/lib/usage-limits.shared";
import { useMilestoneStore } from "@/stores/milestone-store";

const log = createLogger("hooks/use-save-scanned-document");

/** Tiny blurred placeholder of page 1 for the grid card (best-effort) */
async function coverBlur(page: FinishedScanPage): Promise<string | undefined> {
  try {
    const file = new File([page.image], "page-1.jpg", { type: "image/jpeg" });
    return (await getImagePreview(file)).blurDataUrl ?? undefined;
  } catch (error) {
    log.warn({ error }, "Failed to generate the document blur placeholder");
    return undefined;
  }
}

/**
 * Saves a scanned document: uploads each page (and its colour original) to
 * storage as it's rendered — so only one page's images are held at a time —
 * then creates the document item. Reports its own success/errors via toasts
 * and resolves whether it saved.
 *
 * Uploaded files are removed again only when the document definitely wasn't
 * created: an upload/render failure, or the API answering with an error. If
 * the request itself failed (e.g. the connection dropped) the document may
 * have been created, so its files are left in place rather than risk breaking
 * it.
 */
export function useSaveScannedDocument() {
  const supabase = useMemo(() => createClient(), []);
  const invalidateItems = useInvalidateItems();
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    async (
      pages: AsyncIterable<FinishedScanPage>,
      { pageCount }: { pageCount: number },
    ): Promise<boolean> => {
      const uploaded: string[] = [];
      let requestSent = false;

      const removeUploaded = async () => {
        if (uploaded.length === 0) return;
        const { error } = await supabase.storage.from("items").remove(uploaded);
        if (error) {
          // Orphaned files in the user's own folder; report so it's visible
          log.warn(
            { error },
            "Failed to remove uploads of an unsaved document",
          );
          posthog.captureException(error);
        }
      };

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) {
          toast.error("You must be signed in to save.");
          return false;
        }

        const upload = async (blob: Blob): Promise<string> => {
          const key = `${user.id}/${crypto.randomUUID()}.jpg`;
          const { error } = await supabase.storage
            .from("items")
            .upload(key, blob, { contentType: "image/jpeg", upsert: false });
          if (error) throw error;
          uploaded.push(key);
          return key;
        };

        const bodyPages: CreateDocumentBody["pages"] = [];
        let blurDataUrl: string | undefined;
        for await (const page of pages) {
          if (bodyPages.length === 0) blurDataUrl = await coverBlur(page);
          const fileKey = await upload(page.image);
          const originalFileKey = page.original
            ? await upload(page.original)
            : fileKey;
          bodyPages.push({
            fileKey,
            originalFileKey,
            filter: page.filter,
            width: page.width,
            height: page.height,
            size: page.image.size + (page.original?.size ?? 0),
          });
        }

        const body: CreateDocumentBody = {
          pages: bodyPages,
          ...(blurDataUrl ? { blurDataUrl } : {}),
        };
        requestSent = true;
        await api.post("/api/v1/items/documents", body);

        useMilestoneStore.getState().markComplete("scan_first_document");
        toast.success(
          pageCount === 1
            ? "Document saved"
            : `Document saved (${pageCount} pages)`,
        );
        if (pathname === "/" || pathname.startsWith("/dashboard")) {
          invalidateItems();
        } else {
          router.push("/dashboard");
        }
        return true;
      } catch (error) {
        log.error({ error }, "Failed to save scanned document");
        const definitelyNotSaved =
          !requestSent || error instanceof ApiClientError;
        if (definitelyNotSaved) await removeUploaded();

        if (isDailyLimitError(error)) {
          toast.error(DAILY_LIMIT_REACHED_MESSAGE);
        } else if (definitelyNotSaved) {
          toast.error("Couldn't save the document. Please try again.");
        } else {
          toast.error(
            "Couldn't confirm the document saved. Check your items before saving again.",
          );
        }
        return false;
      }
    },
    [supabase, invalidateItems, router, pathname],
  );
}
