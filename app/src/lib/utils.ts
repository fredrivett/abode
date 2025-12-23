import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format bytes as a human-readable string (e.g., "1.5 GB")
 */
export function formatBytes(bytes: bigint | number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = typeof bytes === "bigint" ? Number(bytes) : bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Get initials from a user's first name, last name, or email.
 * Simpler version for admin panel where we have these as separate params.
 */
export function getUserInitials(
  firstName: string | null,
  lastName: string | null,
  email: string,
): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

/**
 * Safely extract file size from item metadata.
 * Returns 0 if size is not a valid non-negative number.
 */
export function getFileSizeFromMeta(meta: unknown): bigint {
  if (
    meta &&
    typeof meta === "object" &&
    "size" in meta &&
    typeof (meta as { size: unknown }).size === "number"
  ) {
    const size = (meta as { size: number }).size;
    // Ensure non-negative
    return size > 0 ? BigInt(Math.floor(size)) : BigInt(0);
  }
  return BigInt(0);
}
