"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/get-initials";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  avatarUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
};

export function UserAvatar({
  avatarUrl,
  firstName,
  lastName,
  username,
  email,
  alt,
  className,
  fallbackClassName,
}: UserAvatarProps) {
  const displayName = username ? `@${username}` : email || "User";
  const initials = getInitials({
    firstName,
    lastName,
    fallback: username,
    email,
  });

  return (
    <Avatar key={avatarUrl || "fallback"} className={cn("size-10", className)}>
      {avatarUrl ? (
        <AvatarImage src={avatarUrl} alt={alt || displayName} />
      ) : null}
      <AvatarFallback className={fallbackClassName}>{initials}</AvatarFallback>
    </Avatar>
  );
}
