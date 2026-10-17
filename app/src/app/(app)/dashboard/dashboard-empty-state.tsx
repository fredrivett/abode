"use client";

import { Home, Link2, Upload } from "lucide-react";
import posthog from "posthog-js";
import { type ChangeEvent, useCallback, useRef } from "react";
import { AbodeLogo } from "@/components/abode-logo";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import { useUpload } from "@/hooks/use-upload";
import {
  MAX_IMAGE_UPLOAD_LABEL,
  MAX_PDF_UPLOAD_LABEL,
  UPLOAD_ACCEPT,
} from "@/lib/uploads";
import { useCommandPaletteStore } from "@/stores/command-palette-store";

export type EmptyStateAction = "upload" | "paste_link";

type DashboardEmptyStateViewProps = {
  isUploading: boolean;
  /** A file was chosen in the native picker */
  onFileSelected: (file: File) => void;
  onPasteLink: () => void;
  /** Either button was pressed, for analytics */
  onActionClick?: (action: EmptyStateAction) => void;
};

/**
 * The dashboard's "no items yet" state: what abode saves, and buttons to add a
 * first item that work without a keyboard or drag and drop (i.e. on mobile).
 * The upload button opens the native picker, which on phones also offers the
 * photo library and camera.
 */
export function DashboardEmptyStateView({
  isUploading,
  onFileSelected,
  onPasteLink,
  onActionClick,
}: DashboardEmptyStateViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFileSelected(file);
    // Reset so choosing the same file again still fires a change
    event.target.value = "";
  };

  return (
    <div className="@container flex min-h-[calc(100vh-18rem)] w-full items-center justify-center rounded-xl border border-border border-dashed bg-muted/20 px-6 py-12 text-center">
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4">
        <Home className="size-14 text-muted-foreground" />
        <div className="space-y-2">
          <h2 className="font-semibold font-serif text-3xl">Welcome home</h2>
          <p className="text-base text-muted-foreground">
            Save links, photos and PDFs to{" "}
            <span className="inline-flex items-baseline">
              <span className="sr-only">Abode</span>
              <AbodeLogo
                className="ml-0.5 h-[0.8em] w-auto text-muted-foreground"
                aria-hidden
              />
            </span>
            . We'll analyze each one automatically so it's easy to search and
            organize later.
          </p>
        </div>

        <div className="mt-2 flex w-full @md:flex-row flex-col justify-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            onChange={onFileChange}
            className="hidden"
            tabIndex={-1}
            data-testid="empty-state-file-input"
          />
          <Button
            size="lg"
            disabled={isUploading}
            onClick={() => {
              onActionClick?.("upload");
              fileInputRef.current?.click();
            }}
          >
            {isUploading ? (
              <IsLoading label="Uploading" />
            ) : (
              <>
                <Upload />
                Upload a photo or PDF
              </>
            )}
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={isUploading}
            onClick={() => {
              onActionClick?.("paste_link");
              onPasteLink();
            }}
          >
            <Link2 />
            Paste a link
          </Button>
        </div>

        {/* Drag and drop / keyboard paste only exist with a mouse or trackpad */}
        <p className="pointer-fine:block hidden text-muted-foreground text-sm">
          You can also drop a file or paste a link anywhere on this page.
        </p>

        <div className="h-px w-36 bg-border" />
        <p className="text-muted-foreground text-xs">
          Images up to {MAX_IMAGE_UPLOAD_LABEL}, PDFs up to{" "}
          {MAX_PDF_UPLOAD_LABEL}
        </p>
      </div>
    </div>
  );
}

/** The empty dashboard, wired to the upload flow and the Add item dialog */
export function DashboardEmptyState() {
  const { handleFileUpload, isFileLoading } = useUpload();
  const setUploadDialogOpen = useCommandPaletteStore(
    (state) => state.setUploadDialogOpen,
  );

  const onFileSelected = useCallback(
    async (file: File) => {
      const success = await handleFileUpload(file, {
        source: "empty_state_picker",
      });
      if (!success) return;
      posthog.capture("item_uploaded", {
        file_type: file.type,
        file_size: file.size,
        source: "empty_state_picker",
      });
    },
    [handleFileUpload],
  );

  return (
    <DashboardEmptyStateView
      isUploading={isFileLoading}
      onFileSelected={onFileSelected}
      onPasteLink={() => setUploadDialogOpen(true, { focusUrl: true })}
      onActionClick={(action) =>
        posthog.capture("empty_state_action_clicked", { action })
      }
    />
  );
}
