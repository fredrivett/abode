"use client";

import { Camera, Trash2 } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import { AvatarCropper } from "@/components/avatar/avatar-cropper";
import { useAvatarUpload } from "@/components/avatar/use-avatar-upload";
import { UserAvatar } from "@/components/avatar/user-avatar";
import { Button } from "@/components/ui/button";

type AvatarSettingsProps = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  initialAvatarUrl?: string | null;
};

export function AvatarSettings({
  firstName,
  lastName,
  username,
  email,
  initialAvatarUrl,
}: AvatarSettingsProps) {
  const handleSuccess = useCallback(() => {
    toast.success("Avatar updated");
  }, []);

  const handleError = useCallback((error: Error) => {
    toast.error(error.message);
  }, []);

  const {
    avatarUrl,
    selectedImage,
    isCropperOpen,
    isUploading,
    isDeleting,
    fileInputRef,
    openFilePicker,
    handleFileSelect,
    handleCropComplete,
    handleCropperClose,
    handleDelete,
  } = useAvatarUpload({
    initialAvatarUrl,
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const onDelete = useCallback(async () => {
    const success = await handleDelete();
    if (success) {
      toast.success("Avatar removed");
    }
  }, [handleDelete]);

  return (
    <section className="rounded-xl border p-6">
      <h3 className="text-lg font-semibold">Profile photo</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Your photo appears on your public profile and in shared rooms.
      </p>

      <div className="mt-4 flex items-center gap-4">
        <div className="relative">
          <UserAvatar
            avatarUrl={avatarUrl}
            firstName={firstName}
            lastName={lastName}
            username={username}
            email={email}
            className="size-16"
            fallbackClassName="text-xl"
          />
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute -right-1 -bottom-1 size-6 rounded-full shadow-md"
            onClick={openFilePicker}
            disabled={isUploading}
          >
            <Camera className="size-3" />
            <span className="sr-only">Upload photo</span>
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openFilePicker}
            disabled={isUploading}
          >
            {isUploading ? "Uploading..." : "Change photo"}
          </Button>
          {avatarUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={isDeleting}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="mr-1 size-4" />
              {isDeleting ? "Removing..." : "Remove"}
            </Button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {selectedImage && (
        <AvatarCropper
          open={isCropperOpen}
          onOpenChange={handleCropperClose}
          imageSrc={selectedImage}
          onCropComplete={handleCropComplete}
          isUploading={isUploading}
        />
      )}
    </section>
  );
}
