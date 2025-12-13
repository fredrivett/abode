"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { createLogger } from "@/lib/logger.client";
import { createClient } from "@/lib/supabase/client";

const log = createLogger("dashboard/dropzone");

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

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

  const handleUpload = useCallback(
    async (file: File) => {
      if (!allowedImageTypes.has(file.type)) {
        toast.error(
          "Unsupported file type. Choose a jpg, png, gif, or webp image.",
        );
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.error("File is too large. Max size is 50MB.");
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
            source: "upload",
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

      {(isDragging || isUploading) && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-primary/60 bg-primary/5">
          <div className="rounded-md bg-background/90 px-4 py-3 text-center shadow">
            <p className="text-sm font-medium text-primary">
              {isUploading ? "Uploading" : "Drop your image to upload"}
            </p>
            {!isUploading ? (
              <p className="text-xs text-muted-foreground">
                JPG, PNG, GIF, or WEBP up to 50MB
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
