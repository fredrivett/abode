import { AVATARS_BUCKET_MAX_BYTES } from "./storage-buckets";

export const MAX_AVATAR_SIZE = AVATARS_BUCKET_MAX_BYTES;
export const ALLOWED_AVATAR_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedAvatarType = (typeof ALLOWED_AVATAR_TYPES)[number];

/**
 * Type guard that checks if a MIME type string is an allowed avatar format
 * (JPEG, PNG, or WebP).
 */
export function isAllowedAvatarType(type: string): type is AllowedAvatarType {
  return ALLOWED_AVATAR_TYPES.includes(type as AllowedAvatarType);
}
