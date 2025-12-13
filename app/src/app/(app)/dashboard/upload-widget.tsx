"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { createLogger } from "@/lib/logger.client";
import { createClient } from "@/lib/supabase/client";

const log = createLogger("dashboard/upload-widget");

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

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
  const router = useRouter();
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

    if (!allowedImageTypes.has(file.type)) {
      toast.error(
        "Unsupported file type. Choose a jpg, png, gif, or webp image.",
      );
      resetFile();
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("File is too large. Max size is 50MB.");
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
          source: "upload",
        });
      } catch (itemError) {
        await supabase.storage.from("items").remove([objectPath]);
        throw itemError;
      }

      toast.success("Upload complete");
      resetFile();
      router.refresh();
    } catch (error) {
      log.error({ error }, "Upload error");
      toast.error("Upload failed. Please try again.");
      resetFile();
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-lg space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Upload an item</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Images only, up to 50MB. Stored privately per user.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={Array.from(allowedImageTypes).join(",")}
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
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Selected: {fileName}
        </p>
      ) : null}
    </div>
  );
}
