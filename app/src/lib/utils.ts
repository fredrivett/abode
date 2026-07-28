import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names using clsx and tailwind-merge, resolving Tailwind
 * conflicts so the last conflicting utility wins.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format bytes as a human-readable string (e.g., "1.5 GB")
 */
export function formatBytes(bytes: bigint | number): string {
  const { value, unit } = formatBytesParts(bytes);
  return `${value} ${unit}`;
}

/**
 * Format bytes and return value and unit separately for custom styling
 */
export function formatBytesParts(bytes: bigint | number): {
  value: string;
  unit: string;
} {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let num = typeof bytes === "bigint" ? Number(bytes) : bytes;
  let unitIndex = 0;

  while (num >= 1024 && unitIndex < units.length - 1) {
    num /= 1024;
    unitIndex++;
  }

  return {
    value: num.toFixed(unitIndex === 0 ? 0 : 1),
    unit: units[unitIndex],
  };
}

/**
 * Format a USD amount for display. Sub-cent amounts (common for per-call AI
 * spend) keep 4 decimals so they don't collapse to "$0.00"; everything else
 * uses standard 2-decimal currency formatting with thousands separators.
 */
export function formatUsd(amount: number): string {
  if (amount > 0 && amount < 0.01) {
    return `$${amount.toFixed(4)}`;
  }
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
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

/**
 * Format duration in seconds to MM:SS or HH:MM:SS format
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
