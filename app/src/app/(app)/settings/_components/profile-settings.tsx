"use client";

import { Camera, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { AvatarCropper } from "@/components/avatar/avatar-cropper";
import { useAvatarUpload } from "@/components/avatar/use-avatar-upload";
import { UserAvatar } from "@/components/avatar/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IsLoading } from "@/components/ui/is-loading";
import { Label } from "@/components/ui/label";
import { useUserStore } from "@/stores/user-store";

type ProfileSettingsProps = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  initialAvatarUrl?: string | null;
};

export function ProfileSettings({
  firstName: initialFirstName,
  lastName: initialLastName,
  username,
  email,
  initialAvatarUrl,
}: ProfileSettingsProps) {
  const setAvatarUrl = useUserStore((state) => state.setAvatarUrl);
  const [firstName, setFirstName] = useState(initialFirstName ?? "");
  const [lastName, setLastName] = useState(initialLastName ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const hasNameChanges =
    firstName !== (initialFirstName ?? "") ||
    lastName !== (initialLastName ?? "");

  const handleSuccess = useCallback(
    (newAvatarUrl: string) => {
      toast.success("Avatar updated");
      setAvatarUrl(newAvatarUrl);
    },
    [setAvatarUrl],
  );

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
      setAvatarUrl(null);
    }
  }, [handleDelete, setAvatarUrl]);

  const handleSaveName = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/v1/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-xl border p-6">
      <h3 className="text-lg font-semibold">Profile</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Your avatar and name appear in shared or public rooms.
      </p>

      <div className="mt-4 flex items-start gap-4">
        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={openFilePicker}
              disabled={isUploading}
              className="cursor-pointer disabled:cursor-not-allowed"
            >
              <UserAvatar
                avatarUrl={avatarUrl}
                firstName={firstName || undefined}
                lastName={lastName || undefined}
                username={username}
                email={email}
                className="size-20 text-xl"
                fallbackClassName="text-xl"
              />
              <span className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full bg-secondary shadow-md">
                <Camera className="size-3.5" />
                <span className="sr-only">Upload avatar</span>
              </span>
            </button>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openFilePicker}
              disabled={isUploading}
            >
              {isUploading ? <IsLoading label="Uploading" /> : "Change"}
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onDelete}
                disabled={isDeleting}
                className="size-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
                <span className="sr-only">
                  {isDeleting ? "Removing" : "Remove"}
                </span>
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jane"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Doe"
            />
          </div>
          {hasNameChanges && (
            <Button
              type="button"
              size="sm"
              onClick={handleSaveName}
              disabled={isSaving}
              className="self-start"
            >
              {isSaving ? <IsLoading label="Saving" /> : "Save changes"}
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
