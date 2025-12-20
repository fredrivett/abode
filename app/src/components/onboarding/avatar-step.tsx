"use client";

import { Camera } from "lucide-react";
import { AvatarCropper } from "@/components/avatar/avatar-cropper";
import { useAvatarUpload } from "@/components/avatar/use-avatar-upload";
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
  const {
    avatarUrl,
    selectedImage,
    isCropperOpen,
    isUploading,
    fileInputRef,
    openFilePicker,
    handleFileSelect,
    handleCropComplete,
    handleCropperClose,
  } = useAvatarUpload({
    initialAvatarUrl,
    onSuccess: onAvatarChange,
    // Silent errors in onboarding - don't block user from continuing
  });

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
          onClick={openFilePicker}
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
        onClick={openFilePicker}
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
