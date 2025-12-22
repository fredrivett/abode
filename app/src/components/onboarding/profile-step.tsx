"use client";

import { Camera } from "lucide-react";
import { useState } from "react";
import { AvatarCropper } from "@/components/avatar/avatar-cropper";
import { useAvatarUpload } from "@/components/avatar/use-avatar-upload";
import { UserAvatar } from "@/components/avatar/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProfileStepProps = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  initialAvatarUrl?: string | null;
  onAvatarChange?: (avatarUrl: string) => void;
  onFirstNameChange?: (firstName: string) => void;
  onLastNameChange?: (lastName: string) => void;
};

export function ProfileStep({
  firstName: initialFirstName,
  lastName: initialLastName,
  username,
  email,
  initialAvatarUrl,
  onAvatarChange,
  onFirstNameChange,
  onLastNameChange,
}: ProfileStepProps) {
  const [firstName, setFirstName] = useState(initialFirstName ?? "");
  const [lastName, setLastName] = useState(initialLastName ?? "");

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

  const handleFirstNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFirstName(value);
    onFirstNameChange?.(value);
  };

  const handleLastNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLastName(value);
    onLastNameChange?.(value);
  };

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <h2 className="text-lg font-semibold leading-none">
        Set up your profile
      </h2>
      <p className="text-base text-muted-foreground">
        Add your name and a photo so others can recognize you.
      </p>

      <div className="relative mt-2">
        <UserAvatar
          avatarUrl={avatarUrl}
          firstName={firstName || undefined}
          lastName={lastName || undefined}
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
        onClick={openFilePicker}
      >
        Choose photo
      </Button>

      <div className="mt-2 grid w-full grid-cols-2 gap-3 text-left">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={handleFirstNameChange}
            placeholder="Jane"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            value={lastName}
            onChange={handleLastNameChange}
            placeholder="Doe"
          />
        </div>
      </div>

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
