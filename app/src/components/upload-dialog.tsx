"use client";

import { Info, Upload } from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useMediaQuery } from "usehooks-ts";
import { useUpload } from "@/hooks/use-upload";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_UPLOAD_LABEL,
} from "@/lib/uploads";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { IsLoading } from "./ui/is-loading";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadDialog({ open, onOpenChange }: UploadDialogProps) {
  const [url, setUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [infoPopoverOpen, setInfoPopoverOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDesktop = useMediaQuery("(min-width: 640px)");

  const handleClose = useCallback(() => {
    setUrl("");
    setIsDragging(false);
    onOpenChange(false);
  }, [onOpenChange]);

  // Autofocus input only on desktop
  useEffect(() => {
    if (open && isDesktop) {
      // Small delay to ensure dialog is mounted
      const timeout = setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [open, isDesktop]);

  const {
    handleUrlSubmit,
    handleFileUpload,
    isUrlLoading,
    isFileLoading,
    isLoading,
  } = useUpload({
    onSuccess: handleClose,
  });

  const onUrlSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      await handleUrlSubmit(url);
    },
    [handleUrlSubmit, url],
  );

  const onFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        await handleFileUpload(file);
      }
      // Reset input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFileUpload],
  );

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (isLoading) return;

      const file = e.dataTransfer?.files?.[0];
      if (file) {
        await handleFileUpload(file);
      }
    },
    [handleFileUpload, isLoading],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only set isDragging to false if we're leaving the drop zone entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false);
    }
  }, []);

  const infoContent =
    "You can also paste URLs or drag and drop images directly onto the dashboard";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => {
          // Prevent default autofocus - we handle it manually
          e.preventDefault();
        }}
      >
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-1.5">
            Add Item
            <Popover open={infoPopoverOpen} onOpenChange={setInfoPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex"
                  aria-label="More info"
                >
                  <Info className="size-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" className="max-w-[200px] text-sm">
                {infoContent}
              </PopoverContent>
            </Popover>
          </DialogTitle>
          <DialogDescription className="text-left">
            Paste a URL or upload an image
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <form onSubmit={onUrlSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder="Paste URL..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !url.trim()}>
              {isUrlLoading ? <IsLoading label="Adding" /> : "Add"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                or
              </span>
            </div>
          </div>

          {/* biome-ignore lint/a11y/noStaticElementInteractions: dropzone requires drag event handlers */}
          <div
            className={cn(
              "flex flex-col items-center gap-3 rounded-lg bg-gray-100 dark:bg-gray-900/50 border-2 border-dashed p-6 transition-colors",
              isDragging
                ? "border-primary/50 bg-primary/5"
                : "border-muted-foreground/25",
              isLoading && "pointer-events-none opacity-50",
            )}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragEnter={onDragOver}
            onDragLeave={onDragLeave}
          >
            <p className="text-sm text-muted-foreground">Drop image here or</p>

            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_IMAGE_MIME_TYPES.join(",")}
              onChange={onFileChange}
              className="hidden"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              {isFileLoading ? (
                <IsLoading label="Uploading" />
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Choose Image
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground">
              JPEG, PNG, GIF, or WebP up to {MAX_IMAGE_UPLOAD_LABEL}
            </p>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
