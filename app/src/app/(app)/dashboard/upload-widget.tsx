"use client";

import posthog from "posthog-js";
import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { useInvalidateItems } from "@/lib/api-hooks";
import { createLogger } from "@/lib/logger.client";
import { createClient } from "@/lib/supabase/client";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  allowedImageMimeTypes,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_LABEL,
} from "@/lib/uploads";

const log = createLogger("dashboard/upload-widget");

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

export function UploadWidget() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);
  const invalidateItems = useInvalidateItems();
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const resetFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setFileName(null);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    if (!allowedImageMimeTypes.has(file.type)) {
      toast.error(
        "Unsupported file type. Choose a jpg, png, gif, or webp image.",
      );
      resetFile();
      return;
    }

    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      toast.error(`File is too large. Max size is ${MAX_IMAGE_UPLOAD_LABEL}.`);
      resetFile();
      return;
    }

    let objectPath: string | undefined;
    setIsUploading(true);
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        toast.error("You must be signed in to upload.");
        resetFile();
        return;
      }

      // Get image dimensions before upload
      let dimensions: { width: number; height: number } | undefined;
      try {
        dimensions = await getImageDimensions(file);
      } catch (error) {
        log.warn({ error }, "Failed to get image dimensions");
      }

      const ext = file.name.includes(".")
        ? file.name.split(".").pop()?.toLowerCase()
        : undefined;
      objectPath = `${user.id}/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;

      const { error: uploadError } = await supabase.storage
        .from("items")
        .upload(objectPath, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        toast.error(uploadError.message);
        resetFile();
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

      // Track item upload event
      posthog.capture("item_uploaded", {
        file_type: file.type,
        file_size: file.size,
        width: dimensions?.width,
        height: dimensions?.height,
        source: "upload_widget",
      });

      toast.success("Upload complete");
      resetFile();
      invalidateItems();
    } catch (error) {
      log.error({ error }, "Upload error");
      posthog.captureException(error);
      toast.error("Upload failed. Please try again.");
      resetFile();
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-lg space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Upload an item</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Images only, up to {MAX_IMAGE_UPLOAD_LABEL}. Stored privately per
          user.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_IMAGE_MIME_TYPES.join(",")}
        onChange={handleFileChange}
        className="hidden"
        disabled={isUploading}
      />

      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? "Uploading" : "Select a file to upload"}
      </Button>

      {fileName ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Selected: {fileName}
        </p>
      ) : null}
    </div>
  );
}
