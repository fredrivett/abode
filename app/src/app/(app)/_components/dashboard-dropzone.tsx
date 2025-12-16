"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { createLogger } from "@/lib/logger.client";
import { createClient } from "@/lib/supabase/client";
import {
  allowedImageMimeTypes,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_LABEL,
} from "@/lib/uploads";

const log = createLogger("dashboard/dropzone");

function isValidUrl(text: string): boolean {
  try {
    const url = new URL(text);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function hasFiles(dataTransfer?: DataTransfer | null) {
  if (!dataTransfer) return false;
  if (dataTransfer.items && dataTransfer.items.length > 0) {
    return Array.from(dataTransfer.items).some((item) => item.kind === "file");
  }
  if (dataTransfer.types && dataTransfer.types.length > 0) {
    return Array.from(dataTransfer.types).includes("Files");
  }
  return false;
}

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

export function DashboardDropzone({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmittingUrl, setIsSubmittingUrl] = useState(false);

  const handleUrlSubmit = useCallback(
    async (url: string) => {
      setIsSubmittingUrl(true);
      try {
        await api.post("/api/v1/items/from-url", { url });
        toast.success("URL added - processing in background");
        router.refresh();
      } catch (error) {
        log.error({ error }, "URL submission error");
        toast.error("Failed to add URL. Please try again.");
      } finally {
        setIsSubmittingUrl(false);
      }
    },
    [router],
  );

  // Listen for paste events globally
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      // Don't intercept paste if user is typing in an input
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const text = event.clipboardData?.getData("text/plain")?.trim();
      if (!text || !isValidUrl(text)) {
        return;
      }

      // Prevent default paste behavior
      event.preventDefault();

      if (isSubmittingUrl || isUploading) {
        toast.error("Please wait for the current operation to complete");
        return;
      }

      void handleUrlSubmit(text);
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handleUrlSubmit, isSubmittingUrl, isUploading]);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!allowedImageMimeTypes.has(file.type)) {
        toast.error(
          "Unsupported file type. Choose a jpg, png, gif, or webp image.",
        );
        return;
      }

      if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
        toast.error(
          `File is too large. Max size is ${MAX_IMAGE_UPLOAD_LABEL}.`,
        );
        return;
      }

      setIsUploading(true);
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          toast.error("You must be signed in to upload.");
          return;
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
          return;
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
        router.refresh();
      } catch (error) {
        log.error({ error }, "Drop upload error");
        toast.error("Upload failed. Please try again.");
      } finally {
        setIsUploading(false);
      }
    },
    [router, supabase],
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: dropzone requires drag event handlers
    <div
      className="relative"
      onDragOver={(event) => {
        if (!hasFiles(event.dataTransfer)) return;
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragEnter={(event) => {
        if (!hasFiles(event.dataTransfer)) return;
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        const next = event.relatedTarget as Node | null;
        if (next && event.currentTarget.contains(next)) return;
        setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        if (isUploading) return;

        const file = event.dataTransfer?.files?.[0];
        if (!file) return;

        void handleUpload(file);
      }}
    >
      {children}

      {(isDragging || isUploading || isSubmittingUrl) && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-primary/60 bg-primary/5">
          <div className="rounded-md bg-background/90 px-4 py-3 text-center shadow">
            <p className="text-sm font-medium text-primary">
              {isUploading
                ? "Uploading"
                : isSubmittingUrl
                  ? "Adding URL"
                  : "Drop your image to upload"}
            </p>
            {!isUploading && !isSubmittingUrl ? (
              <p className="text-xs text-muted-foreground">
                JPG, PNG, GIF, or WEBP up to {MAX_IMAGE_UPLOAD_LABEL}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
