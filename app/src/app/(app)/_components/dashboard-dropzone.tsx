"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { IsLoading } from "@/components/ui/is-loading";
import { useUpload } from "@/hooks/use-upload";
import { MAX_IMAGE_UPLOAD_LABEL } from "@/lib/uploads";
import { isValidUrl } from "@/lib/url-utils";

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

export function DashboardDropzone({ children }: { children: React.ReactNode }) {
  const [isDragging, setIsDragging] = useState(false);
  const {
    handleUrlSubmit,
    handleFileUpload,
    isUrlLoading,
    isFileLoading,
    isLoading,
  } = useUpload();

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

      if (isLoading) {
        toast.error("Please wait for the current operation to complete");
        return;
      }

      void handleUrlSubmit(text);
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handleUrlSubmit, isLoading]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: dropzone requires drag event handlers
    <div
      className="relative flex-1"
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
        if (isFileLoading) return;

        const file = event.dataTransfer?.files?.[0];
        if (!file) return;

        void handleFileUpload(file);
      }}
    >
      {children}

      {(isDragging || isFileLoading || isUrlLoading) && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-primary/60 border-dashed bg-primary/5">
          <div className="rounded-md bg-background/90 px-4 py-3 text-center shadow">
            <p className="font-medium text-primary text-sm">
              {isFileLoading ? (
                <IsLoading label="Uploading" />
              ) : isUrlLoading ? (
                <IsLoading label="Adding URL" />
              ) : (
                "Drop your image to upload"
              )}
            </p>
            {!isFileLoading && !isUrlLoading ? (
              <p className="text-muted-foreground text-xs">
                JPG, PNG, GIF, or WEBP up to {MAX_IMAGE_UPLOAD_LABEL}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
