import { nanoid } from "nanoid";

/**
 * Invite token configuration
 */
export const INVITE_TOKEN_LENGTH = 21;
export const INVITE_EXPIRY_DAYS = 7;

/**
 * Generate a secure, URL-safe invite token
 */
export function generateInviteToken(): string {
  return nanoid(INVITE_TOKEN_LENGTH);
}

/**
 * Calculate invite expiry date (7 days from now)
 */
export function getInviteExpiryDate(): Date {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + INVITE_EXPIRY_DAYS);
  return expiryDate;
}

/**
 * Check if an invite has expired based on its expiresAt date
 */
export function isInviteExpired(expiresAt: Date): boolean {
  return expiresAt < new Date();
}
