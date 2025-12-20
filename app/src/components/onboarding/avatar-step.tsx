"use client";

import { Camera } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { AvatarCropper } from "@/components/avatar/avatar-cropper";
import { UserAvatar } from "@/components/avatar/user-avatar";
import { Button } from "@/components/ui/button";

type AvatarStepProps = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  initialAvatarUrl?: string | null;
  onAvatarChange?: (avatarUrl: string) => void;
};

export function AvatarStep({
  firstName,
  lastName,
  username,
  email,
  initialAvatarUrl,
  onAvatarChange,
}: AvatarStepProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    initialAvatarUrl ?? null,
  );
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Create object URL for cropper preview
      const objectUrl = URL.createObjectURL(file);
      setSelectedImage(objectUrl);
      setIsCropperOpen(true);

      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [],
  );

  const handleCropComplete = useCallback(
    async (croppedBlob: Blob) => {
      setIsUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", croppedBlob, "avatar.jpg");

        const response = await fetch("/api/v1/user/avatar", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Failed to upload avatar");
        }

        const data = await response.json();
        setAvatarUrl(data.avatarUrl);
        onAvatarChange?.(data.avatarUrl);
        setIsCropperOpen(false);
      } catch {
        // Silently fail - upload errors don't block the user from continuing
      } finally {
        setIsUploading(false);
        // Clean up object URL
        if (selectedImage) {
          URL.revokeObjectURL(selectedImage);
          setSelectedImage(null);
        }
      }
    },
    [selectedImage, onAvatarChange],
  );

  const handleCropperClose = useCallback(
    (open: boolean) => {
      if (!open && selectedImage) {
        URL.revokeObjectURL(selectedImage);
        setSelectedImage(null);
      }
      setIsCropperOpen(open);
    },
    [selectedImage],
  );

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <h2 className="text-lg font-semibold leading-none">
        Add a profile photo
      </h2>
      <p className="text-base text-muted-foreground">
        Help others recognize you by adding a profile photo.
      </p>

      <div className="relative mt-2">
        <UserAvatar
          avatarUrl={avatarUrl}
          firstName={firstName}
          lastName={lastName}
          username={username}
          email={email}
          className="size-24 text-2xl"
          fallbackClassName="text-2xl"
        />
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="absolute -right-1 -bottom-1 size-8 rounded-full shadow-md"
          onClick={() => fileInputRef.current?.click()}
        >
          <Camera className="size-4" />
          <span className="sr-only">Upload photo</span>
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={() => fileInputRef.current?.click()}
      >
        Choose photo
      </Button>

      {selectedImage && (
        <AvatarCropper
          open={isCropperOpen}
          onOpenChange={handleCropperClose}
          imageSrc={selectedImage}
          onCropComplete={handleCropComplete}
          isUploading={isUploading}
        />
      )}
    </div>
  );
}
