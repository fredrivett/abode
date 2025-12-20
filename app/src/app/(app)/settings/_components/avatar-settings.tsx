"use client";

import { Camera, Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { AvatarCropper } from "@/components/avatar/avatar-cropper";
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    initialAvatarUrl ?? null,
  );
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const objectUrl = URL.createObjectURL(file);
      setSelectedImage(objectUrl);
      setIsCropperOpen(true);

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
          const data = await response.json();
          throw new Error(data.message || "Failed to upload avatar");
        }

        const data = await response.json();
        setAvatarUrl(data.avatarUrl);
        setIsCropperOpen(false);
        toast.success("Avatar updated");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to upload avatar",
        );
      } finally {
        setIsUploading(false);
        if (selectedImage) {
          URL.revokeObjectURL(selectedImage);
          setSelectedImage(null);
        }
      }
    },
    [selectedImage],
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

  const handleDelete = useCallback(async () => {
    if (!avatarUrl) return;

    setIsDeleting(true);

    try {
      const response = await fetch("/api/v1/user/avatar", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete avatar");
      }

      setAvatarUrl(null);
      toast.success("Avatar removed");
    } catch {
      toast.error("Failed to remove avatar");
    } finally {
      setIsDeleting(false);
    }
  }, [avatarUrl]);

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
            onClick={() => fileInputRef.current?.click()}
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
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? "Uploading..." : "Change photo"}
          </Button>
          {avatarUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
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
