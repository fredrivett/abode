"use client";

import { ImageIcon } from "lucide-react";
import posthog from "posthog-js";
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

// Dialogs (upload, onboarding, command palette) portal to body and may have
// their own dropzones, so the global drag overlay and drop handling step aside
function isDialogOpen() {
  return (
    document.querySelector(
      '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
    ) !== null
  );
}

/**
 * Full-window dropzone for the dashboard, handling drag-and-drop file uploads
 * and URL paste events.
 *
 * Listens at the window/document level so the entire viewport is the drop
 * target and a stray drop never navigates the browser away. While dragging a
 * file it shows a fixed full-viewport overlay; while an upload or URL
 * submission is in flight it shows a small status pill instead.
 */
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

      void handleUrlSubmit(text).then((success) => {
        if (!success) return;
        posthog.capture("url_pasted", {
          url_domain: new URL(text).hostname,
        });
      });
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handleUrlSubmit, isLoading]);

  // Listen for file drag events globally so the whole window is droppable
  useEffect(() => {
    const handleDragOver = (event: DragEvent) => {
      if (!hasFiles(event.dataTransfer)) return;
      // Prevent the browser navigating to the file wherever it's dropped
      event.preventDefault();
      setIsDragging(!isDialogOpen());
    };

    const handleDragLeave = (event: DragEvent) => {
      // relatedTarget is null when the drag leaves the window
      if (event.relatedTarget) return;
      setIsDragging(false);
    };

    const handleDrop = (event: DragEvent) => {
      setIsDragging(false);
      if (!hasFiles(event.dataTransfer)) return;

      // An open dialog's own dropzone may have already handled this drop
      const alreadyHandled = event.defaultPrevented;
      event.preventDefault();
      if (alreadyHandled || isDialogOpen() || isFileLoading) return;

      const file = event.dataTransfer?.files?.[0];
      if (!file) return;

      void handleFileUpload(file).then((success) => {
        if (!success) return;
        posthog.capture("item_uploaded", {
          file_type: file.type,
          file_size: file.size,
          source: "dashboard_drop",
        });
      });
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragenter", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragenter", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [handleFileUpload, isFileLoading]);

  return (
    <>
      {children}

      {isDragging && (
        <div className="fade-in-0 fixed inset-0 z-50 flex animate-in items-center justify-center bg-background/80 p-6 backdrop-blur-sm duration-150">
          <div className="rounded-lg border-2 border-primary/60 border-dashed bg-background px-8 py-6 text-center shadow-lg">
            <ImageIcon className="mx-auto mb-2 h-6 w-6 text-primary" />
            <p className="font-medium text-primary text-sm">
              Drop your image to upload
            </p>
            <p className="text-muted-foreground text-xs">
              JPG, PNG, GIF, or WEBP up to {MAX_IMAGE_UPLOAD_LABEL}
            </p>
          </div>
        </div>
      )}

      {(isFileLoading || isUrlLoading) && !isDragging && (
        <div
          aria-live="polite"
          className="-translate-x-1/2 fade-in-0 slide-in-from-bottom-2 pointer-events-none fixed bottom-6 left-1/2 z-50 animate-in duration-150"
        >
          <div className="rounded-full border bg-background/95 px-4 py-2 shadow-lg">
            <p className="font-medium text-foreground text-sm">
              {isFileLoading ? (
                <IsLoading label="Uploading" />
              ) : (
                <IsLoading label="Adding URL" />
              )}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
