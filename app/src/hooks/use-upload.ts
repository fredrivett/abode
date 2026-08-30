"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { api, isDailyLimitError } from "@/lib/api-client";
import { useInvalidateItems } from "@/lib/api-hooks";
import { getImagePreview } from "@/lib/image-preview";
import { createLogger } from "@/lib/logger.client";
import { createClient } from "@/lib/supabase/client";
import {
  allowedImageMimeTypes,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_LABEL,
} from "@/lib/uploads";
import { isValidUrl } from "@/lib/url-utils";
import { DAILY_LIMIT_REACHED_MESSAGE } from "@/lib/usage-limits.shared";
import { useMilestoneStore } from "@/stores/milestone-store";

const log = createLogger("hooks/use-upload");

interface UseUploadOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

interface UseUploadReturn {
  handleUrlSubmit: (url: string) => Promise<boolean>;
  handleFileUpload: (file: File) => Promise<boolean>;
  isUrlLoading: boolean;
  isFileLoading: boolean;
  isLoading: boolean;
}

/**
 * Manages URL submission and image file uploads.
 *
 * URL submissions are sent to the API for background processing.
 * File uploads go to Supabase Storage first, then create an item record via the API —
 * if the item creation fails the uploaded file is cleaned up automatically.
 *
 * Both paths show toast notifications, track milestones, invalidate the items cache,
 * and redirect to the dashboard when the user isn't already there.
 */
export function useUpload(options: UseUploadOptions = {}): UseUploadReturn {
  const { onSuccess, onError } = options;
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const invalidateItems = useInvalidateItems();
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  const [isFileLoading, setIsFileLoading] = useState(false);

  const isOnDashboard = pathname === "/" || pathname.startsWith("/dashboard");

  const handleUrlSubmit = useCallback(
    async (url: string): Promise<boolean> => {
      if (!url.trim()) {
        return false;
      }

      if (!isValidUrl(url)) {
        const errorMsg = "Please enter a valid URL";
        toast.error(errorMsg);
        onError?.(errorMsg);
        return false;
      }

      setIsUrlLoading(true);
      try {
        await api.post("/api/v1/items/from-url", { url });
        toast.success("URL added — processing in background");
        useMilestoneStore.getState().markComplete("save_first_url");
        if (isOnDashboard) {
          invalidateItems();
        } else {
          router.push("/dashboard");
        }
        onSuccess?.();
        return true;
      } catch (error) {
        log.error({ error }, "URL submission error");
        const errorMsg = isDailyLimitError(error)
          ? DAILY_LIMIT_REACHED_MESSAGE
          : "Failed to add URL. Please try again.";
        toast.error(errorMsg);
        onError?.(errorMsg);
        return false;
      } finally {
        setIsUrlLoading(false);
      }
    },
    [router, invalidateItems, onSuccess, onError, isOnDashboard],
  );

  const handleFileUpload = useCallback(
    async (file: File): Promise<boolean> => {
      if (!allowedImageMimeTypes.has(file.type)) {
        const errorMsg =
          "Unsupported file type. Choose a jpg, png, gif, or webp image.";
        toast.error(errorMsg);
        onError?.(errorMsg);
        return false;
      }

      if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
        const errorMsg = `File is too large. Max size is ${MAX_IMAGE_UPLOAD_LABEL}.`;
        toast.error(errorMsg);
        onError?.(errorMsg);
        return false;
      }

      setIsFileLoading(true);
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          const errorMsg = "You must be signed in to upload.";
          toast.error(errorMsg);
          onError?.(errorMsg);
          return false;
        }

        let dimensions: { width: number; height: number } | undefined;
        let blurDataUrl: string | null = null;
        try {
          const preview = await getImagePreview(file);
          dimensions = { width: preview.width, height: preview.height };
          blurDataUrl = preview.blurDataUrl;
        } catch (error) {
          log.warn({ error }, "Failed to read image preview");
        }

        const ext = file.name.includes(".")
          ? file.name.split(".").pop()?.toLowerCase()
          : undefined;
        const objectPath = `${user.id}/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;

        const { error: uploadError } = await supabase.storage
          .from("items")
          .upload(objectPath, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });

        if (uploadError) {
          toast.error(uploadError.message);
          onError?.(uploadError.message);
          return false;
        }

        try {
          await api.post("/api/v1/items", {
            kind: "image",
            fileKey: objectPath,
            meta: {
              originalName: file.name,
              size: file.size,
              type: file.type,
              width: dimensions?.width,
              height: dimensions?.height,
              ...(blurDataUrl ? { blurDataUrl } : {}),
            },
            sourceType: "upload",
          });
        } catch (itemError) {
          await supabase.storage.from("items").remove([objectPath]);
          throw itemError;
        }

        toast.success("Upload complete");
        useMilestoneStore.getState().markComplete("upload_first_image");
        if (isOnDashboard) {
          invalidateItems();
        } else {
          router.push("/dashboard");
        }
        onSuccess?.();
        return true;
      } catch (error) {
        log.error({ error }, "File upload error");
        const errorMsg = isDailyLimitError(error)
          ? DAILY_LIMIT_REACHED_MESSAGE
          : "Upload failed. Please try again.";
        toast.error(errorMsg);
        onError?.(errorMsg);
        return false;
      } finally {
        setIsFileLoading(false);
      }
    },
    [router, supabase, invalidateItems, onSuccess, onError, isOnDashboard],
  );

  return {
    handleUrlSubmit,
    handleFileUpload,
    isUrlLoading,
    isFileLoading,
    isLoading: isUrlLoading || isFileLoading,
  };
}
