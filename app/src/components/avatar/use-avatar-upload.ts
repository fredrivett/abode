"use client";

import { useCallback, useRef, useState } from "react";
import { isAllowedAvatarType, MAX_AVATAR_SIZE } from "@/lib/avatar";

function validateAvatarFile(file: File): string | null {
  if (!isAllowedAvatarType(file.type)) {
    return "Invalid file type. Allowed: JPEG, PNG, WebP";
  }
  if (file.size > MAX_AVATAR_SIZE) {
    return "File too large. Maximum size is 2MB";
  }
  return null;
}

type UseAvatarUploadOptions = {
  avatarUrl?: string | null;
  onSuccess?: (avatarUrl: string) => void;
  onError?: (error: Error) => void;
};

export function useAvatarUpload({
  avatarUrl,
  onSuccess,
  onError,
}: UseAvatarUploadOptions = {}) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const processFile = useCallback((file: File) => {
    const objectUrl = URL.createObjectURL(file);
    setSelectedImage(objectUrl);
    setIsCropperOpen(true);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const error = validateAvatarFile(file);
      if (error) {
        onError?.(new Error(error));
        e.target.value = "";
        return;
      }

      processFile(file);

      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [processFile, onError],
  );

  const handleFileDrop = useCallback(
    (file: File) => {
      const error = validateAvatarFile(file);
      if (error) {
        onError?.(new Error(error));
        return;
      }
      processFile(file);
    },
    [processFile, onError],
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
        setIsCropperOpen(false);
        onSuccess?.(data.avatarUrl);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error("Upload failed"));
      } finally {
        setIsUploading(false);
        if (selectedImage) {
          URL.revokeObjectURL(selectedImage);
          setSelectedImage(null);
        }
      }
    },
    [selectedImage, onSuccess, onError],
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

      return true;
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error("Delete failed"));
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [avatarUrl, onError]);

  return {
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
  };
}
