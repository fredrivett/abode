"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AvatarCropper } from "@/components/avatar/avatar-cropper";
import { useAvatarUpload } from "@/components/avatar/use-avatar-upload";
import { UserAvatar } from "@/components/avatar/user-avatar";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import { shouldCompleteProfile } from "@/lib/milestones/conditions";
import { cn } from "@/lib/utils";
import { useMilestoneStore } from "@/stores/milestone-store";
import { useUserStore } from "@/stores/user-store";

type UserAvatarSettingProps = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  initialAvatarUrl?: string | null;
};

export function UserAvatarSetting({
  firstName,
  lastName,
  username,
  email,
  initialAvatarUrl,
}: UserAvatarSettingProps) {
  const [isDragging, setIsDragging] = useState(false);
  const storeAvatarUrl = useUserStore((state) => state.avatarUrl);
  const setAvatarUrl = useUserStore((state) => state.setAvatarUrl);

  // Initialize zustand with server value on mount (only when undefined = not yet hydrated)
  useEffect(() => {
    if (storeAvatarUrl === undefined) {
      setAvatarUrl(initialAvatarUrl ?? null);
    }
  }, [initialAvatarUrl, storeAvatarUrl, setAvatarUrl]);

  // Use store value if hydrated (not undefined), otherwise fall back to initial
  // Note: null means "explicitly no avatar", undefined means "not yet hydrated"
  const avatarUrl =
    storeAvatarUrl !== undefined ? storeAvatarUrl : (initialAvatarUrl ?? null);

  const handleSuccess = useCallback(
    (newAvatarUrl: string) => {
      setAvatarUrl(newAvatarUrl);
      // Mark milestone if profile is now complete
      if (shouldCompleteProfile({ firstName, lastName, avatarUrl: newAvatarUrl })) {
        useMilestoneStore.getState().markComplete("complete_profile");
      }
      toast.success("Avatar updated");
    },
    [setAvatarUrl, firstName, lastName],
  );

  const handleError = useCallback((error: Error) => {
    toast.error(error.message);
  }, []);

  const {
    selectedImage,
    isCropperOpen,
    isUploading,
    isDeleting,
    fileInputRef,
    openFilePicker,
    handleFileSelect,
    handleFileDrop,
    handleCropComplete,
    handleCropperClose,
    handleDelete,
  } = useAvatarUpload({
    avatarUrl,
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const handleDeleteClick = useCallback(async () => {
    const success = await handleDelete();
    if (success) {
      setAvatarUrl(null);
      toast.success("Avatar removed");
    }
  }, [handleDelete, setAvatarUrl]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (isUploading) return;

      const file = e.dataTransfer?.files?.[0];
      if (file) {
        handleFileDrop(file);
      }
    },
    [handleFileDrop, isUploading],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false);
    }
  }, []);

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: dropzone requires drag event handlers */}
        <div
          className="relative flex p-1"
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragEnter={onDragOver}
          onDragLeave={onDragLeave}
        >
          <button
            type="button"
            onClick={openFilePicker}
            disabled={isUploading}
            className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed"
          >
            <UserAvatar
              avatarUrl={avatarUrl}
              firstName={firstName}
              lastName={lastName}
              username={username}
              email={email}
              className={cn(
                "size-20 text-xl transition-all",
                isDragging && "opacity-50 ring-2 ring-primary ring-offset-2",
              )}
              fallbackClassName="text-xl"
            />
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="-right-1 -bottom-1 absolute flex size-7 cursor-pointer items-center justify-center rounded-full bg-secondary text-muted-foreground shadow-md transition-colors hover:bg-destructive hover:text-white disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              <span className="sr-only">
                {isDeleting ? "Removing" : "Remove"}
              </span>
            </button>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openFilePicker}
          disabled={isUploading}
        >
          {isUploading ? (
            <IsLoading label="Uploading" />
          ) : avatarUrl ? (
            "Change"
          ) : (
            "Upload"
          )}
        </Button>
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
    </>
  );
}
