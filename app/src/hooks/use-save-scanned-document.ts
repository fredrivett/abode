"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { api, isDailyLimitError } from "@/lib/api-client";
import { useInvalidateItems } from "@/lib/api-hooks";
import type { CreateDocumentBody } from "@/lib/documents/create-document-schema";
import { getImagePreview } from "@/lib/image-preview";
import { createLogger } from "@/lib/logger.client";
import type { FinishedScanPage } from "@/lib/scanner/pages";
import { createClient } from "@/lib/supabase/client";
import { DAILY_LIMIT_REACHED_MESSAGE } from "@/lib/usage-limits.shared";

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
 * storage, then creates the document item. If anything fails, the uploaded
 * files are removed again. Reports its own success/errors via toasts and
 * resolves whether it saved.
 */
export function useSaveScannedDocument() {
  const supabase = useMemo(() => createClient(), []);
  const invalidateItems = useInvalidateItems();
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    async (pages: FinishedScanPage[]): Promise<boolean> => {
      const uploaded: string[] = [];
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
        for (const page of pages) {
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

        const blurDataUrl = await coverBlur(pages[0]);
        const body: CreateDocumentBody = {
          pages: bodyPages,
          ...(blurDataUrl ? { blurDataUrl } : {}),
        };
        await api.post("/api/v1/items/documents", body);

        toast.success(
          pages.length === 1
            ? "Document saved"
            : `Document saved (${pages.length} pages)`,
        );
        if (pathname === "/" || pathname.startsWith("/dashboard")) {
          invalidateItems();
        } else {
          router.push("/dashboard");
        }
        return true;
      } catch (error) {
        log.error({ error }, "Failed to save scanned document");
        if (uploaded.length > 0) {
          await supabase.storage.from("items").remove(uploaded);
        }
        toast.error(
          isDailyLimitError(error)
            ? DAILY_LIMIT_REACHED_MESSAGE
            : "Couldn't save the document. Please try again.",
        );
        return false;
      }
    },
    [supabase, invalidateItems, router, pathname],
  );
}
