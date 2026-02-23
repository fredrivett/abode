"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DialogOrDrawer,
  DialogOrDrawerBody,
  DialogOrDrawerContent,
  DialogOrDrawerDescription,
  DialogOrDrawerFooter,
  DialogOrDrawerHeader,
  DialogOrDrawerTitle,
} from "@/components/ui/dialog-or-drawer";
import { IsLoading } from "@/components/ui/is-loading";
import { api } from "@/lib/api-client";
import { useInvalidateItems } from "@/lib/api-hooks";
import type { ExifGpsLocation } from "@/lib/exif.client";
import { createLogger } from "@/lib/logger.client";
import type { ItemLocation } from "@/lib/types/item";
import { LocationPreview } from "./location-preview";

const log = createLogger("dashboard/location-override-dialog");

type LocationOverrideDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  existingLocation: ItemLocation | null;
  newGpsLocation: ExifGpsLocation;
  sourceFileName: string;
};

/**
 * Confirmation dialog shown when updating an item's location from image EXIF data.
 *
 * Displays current location alongside the new GPS coordinates extracted from a
 * dropped image file. On confirm, POSTs the new coordinates to the location API.
 */
export function LocationOverrideDialog({
  open,
  onOpenChange,
  itemId,
  existingLocation,
  newGpsLocation,
  sourceFileName,
}: LocationOverrideDialogProps) {
  const invalidateItems = useInvalidateItems();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await api.post(`/api/v1/items/${itemId}/location`, {
        latitude: newGpsLocation.latitude,
        longitude: newGpsLocation.longitude,
      });
      toast.success("Location updated");
      invalidateItems();
      onOpenChange(false);
    } catch (error) {
      log.error({ error }, "Failed to update location");
      toast.error("Failed to update location");
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasExistingLocation = existingLocation !== null;
  const showTwoColumns = hasExistingLocation;

  return (
    <DialogOrDrawer open={open} onOpenChange={onOpenChange}>
      <DialogOrDrawerContent
        className={showTwoColumns ? "sm:max-w-2xl" : "sm:max-w-md"}
      >
        <DialogOrDrawerHeader>
          <DialogOrDrawerTitle>Update Location</DialogOrDrawerTitle>
          <DialogOrDrawerDescription>
            Set location from EXIF data in "{sourceFileName}"
          </DialogOrDrawerDescription>
        </DialogOrDrawerHeader>

        <DialogOrDrawerBody
          className={
            showTwoColumns ? "grid grid-cols-2 gap-6" : "flex justify-center"
          }
        >
          {hasExistingLocation && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-zinc-700 dark:text-zinc-300">
                Current Location
              </h4>
              <LocationPreview location={existingLocation} />
            </div>
          )}

          <div className="space-y-2">
            <h4 className="font-medium text-sm text-zinc-700 dark:text-zinc-300">
              New Location
            </h4>
            <LocationPreview
              location={{
                latitude: newGpsLocation.latitude,
                longitude: newGpsLocation.longitude,
              }}
            />
          </div>
        </DialogOrDrawerBody>

        <DialogOrDrawerFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? <IsLoading label="Updating" /> : "Confirm"}
          </Button>
        </DialogOrDrawerFooter>
      </DialogOrDrawerContent>
    </DialogOrDrawer>
  );
}
