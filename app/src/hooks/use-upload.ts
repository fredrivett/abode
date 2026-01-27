"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useInvalidateItems } from "@/lib/api-hooks";
import { createLogger } from "@/lib/logger.client";
import { createClient } from "@/lib/supabase/client";
import {
  allowedImageMimeTypes,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_LABEL,
} from "@/lib/uploads";
import { isValidUrl } from "@/lib/url-utils";
import { useMilestoneStore } from "@/stores/milestone-store";

const log = createLogger("hooks/use-upload");

async function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

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
        const errorMsg = "Failed to add URL. Please try again.";
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
        try {
          dimensions = await getImageDimensions(file);
        } catch (error) {
          log.warn({ error }, "Failed to get image dimensions");
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
        const errorMsg = "Upload failed. Please try again.";
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
