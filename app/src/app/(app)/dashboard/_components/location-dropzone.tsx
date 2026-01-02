"use client";

import { ImageIcon, Info, RotateCcw, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/lib/api-client";
import type { ExifGpsLocation } from "@/lib/exif.client";
import { extractGpsFromFile } from "@/lib/exif.client";
import { createLogger } from "@/lib/logger.client";
import type { ItemLocation } from "@/lib/types/item";
import { allowedImageMimeTypes } from "@/lib/uploads";
import { LocationOverrideDialog } from "./location-override-dialog";
import { LocationPreview } from "./location-preview";

const log = createLogger("dashboard/location-dropzone");

type LocationDropzoneProps = {
  itemId: string;
  displayLocation: ItemLocation | null;
  originalExifLocation: ItemLocation | null;
  isManualOverride: boolean;
  children: React.ReactNode;
};

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

export function LocationDropzone({
  itemId,
  displayLocation,
  originalExifLocation,
  isManualOverride,
  children,
}: LocationDropzoneProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [extractedGps, setExtractedGps] = useState<ExifGpsLocation | null>(
    null,
  );
  const [sourceFileName, setSourceFileName] = useState("");

  const handleFile = useCallback(async (file: File) => {
    if (!allowedImageMimeTypes.has(file.type)) {
      toast.error("Please select an image file (JPG, PNG, GIF, or WEBP)");
      return;
    }

    setIsExtracting(true);
    try {
      const gps = await extractGpsFromFile(file);

      if (!gps) {
        toast.error("No GPS location found in image EXIF data");
        return;
      }

      setExtractedGps(gps);
      setSourceFileName(file.name);
      setDialogOpen(true);
    } catch (error) {
      log.error({ error }, "Failed to extract EXIF");
      toast.error("Failed to read image EXIF data");
    } finally {
      setIsExtracting(false);
    }
  }, []);

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        void handleFile(file);
      }
      // Reset input so the same file can be selected again
      event.target.value = "";
    },
    [handleFile],
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRemoveOverride = useCallback(async () => {
    setIsRemoving(true);
    try {
      await api.delete(`/api/v1/items/${itemId}/location`);
      toast.success("Location override removed");
      setPopoverOpen(false);
      router.refresh();
    } catch (error) {
      log.error({ error }, "Failed to remove location override");
      toast.error("Failed to remove location override");
    } finally {
      setIsRemoving(false);
    }
  }, [itemId, router]);

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: dropzone requires drag event handlers */}
      <div
        className="relative p-2 -m-2"
        onDragOver={(event) => {
          if (!hasFiles(event.dataTransfer)) return;
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(true);
        }}
        onDragEnter={(event) => {
          if (!hasFiles(event.dataTransfer)) return;
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          const next = event.relatedTarget as Node | null;
          if (next && event.currentTarget.contains(next)) return;
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(false);

          if (isExtracting) return;

          const file = event.dataTransfer?.files?.[0];
          if (!file) return;

          void handleFile(file);
        }}
      >
        <div className="space-y-2">
          {/* Header with title and actions */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Location
            </h3>
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleFileInputChange}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost-subtle"
                    size="icon-sm"
                    onClick={handleUploadClick}
                    disabled={isExtracting}
                    className="h-6 w-6"
                  >
                    <Upload className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Drag and drop or click to upload an image to use its location
                  data
                </TooltipContent>
              </Tooltip>

              {isManualOverride && originalExifLocation && (
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost-subtle"
                      size="icon-sm"
                      className="h-6 w-6"
                      title="View original location"
                    >
                      <Info className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="end" className="w-80">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        Original image location:
                      </p>
                      <Button
                        variant="ghost-subtle"
                        size="sm"
                        onClick={handleRemoveOverride}
                        disabled={isRemoving}
                        className="h-6 px-2 text-xs"
                        title="Restore original location"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        {isRemoving ? (
                          <IsLoading label="Restoring" />
                        ) : (
                          "Restore"
                        )}
                      </Button>
                    </div>
                    <LocationPreview location={originalExifLocation} />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          {/* Location content */}
          {children}
        </div>

        {(isDragging || isExtracting) && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary/60 bg-primary/5">
            <div className="rounded-md bg-background/90 px-3 py-2 text-center shadow">
              <ImageIcon className="mx-auto mb-1 h-5 w-5 text-primary" />
              <p className="text-xs font-medium text-primary">
                {isExtracting ? (
                  <IsLoading label="Reading EXIF" iconClassName="size-3" />
                ) : (
                  "Drop image to set location"
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {extractedGps && (
        <LocationOverrideDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          itemId={itemId}
          existingLocation={displayLocation}
          newGpsLocation={extractedGps}
          sourceFileName={sourceFileName}
        />
      )}
    </>
  );
}
