"use client";

import { useCallback, useRef, useState } from "react";
import ReactCrop, {
  type Crop,
  centerCrop,
  convertToPixelCrop,
  makeAspectCrop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IsLoading } from "@/components/ui/is-loading";

type AvatarCropperProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  isUploading?: boolean;
};

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  // For a square crop, maximize the initial selection based on the constraining dimension
  const isLandscape = mediaWidth > mediaHeight;

  return centerCrop(
    makeAspectCrop(
      isLandscape ? { unit: "%", height: 100 } : { unit: "%", width: 100 },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
}

async function getCroppedImg(
  image: HTMLImageElement,
  crop: PixelCrop,
  outputSize: number = 256,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context");
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  // Set canvas size to desired output size
  canvas.width = outputSize;
  canvas.height = outputSize;

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    outputSize,
    outputSize,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Canvas is empty"));
        }
      },
      "image/jpeg",
      0.9,
    );
  });
}

export function AvatarCropper({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
  isUploading = false,
}: AvatarCropperProps) {
  const [crop, setCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      const initialCrop = centerAspectCrop(width, height, 1);
      setCrop(initialCrop);
    },
    [],
  );

  const handleCropComplete = useCallback(async () => {
    if (!crop || !imgRef.current) return;

    // Convert the percent crop to pixel crop ourselves
    // ReactCrop's onComplete reports incorrect values due to internal padding
    const pixelCrop = convertToPixelCrop(
      crop,
      imgRef.current.width,
      imgRef.current.height,
    );

    try {
      const croppedBlob = await getCroppedImg(imgRef.current, pixelCrop);
      onCropComplete(croppedBlob);
    } catch {
      // Silently fail - crop errors are not actionable for the user
    }
  }, [crop, onCropComplete]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crop your photo</DialogTitle>
          <DialogDescription>
            Drag to reposition. The image will be cropped to a square.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            aspect={1}
            className="max-h-[60vh]"
          >
            {/* biome-ignore lint/performance/noImgElement: react-image-crop requires standard img element */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop preview"
              onLoad={onImageLoad}
              className="max-h-[60vh] object-contain"
            />
          </ReactCrop>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCropComplete}
            disabled={!crop || isUploading}
          >
            {isUploading ? <IsLoading label="Uploading" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
