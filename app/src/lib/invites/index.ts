import type { Invite, User } from "@prisma/client";
import db from "@/lib/db";
import { normalizeEmail, validateEmail } from "./email-validation";
import {
  generateInviteToken,
  getInviteExpiryDate,
  isInviteExpired,
} from "./token";

export { normalizeEmail, validateEmail } from "./email-validation";
export {
  generateInviteToken,
  getInviteExpiryDate,
  isInviteExpired,
} from "./token";

/**
 * Result types for invite operations
 */
export type InviteValidationResult =
  | {
      valid: true;
      invite: Invite & {
        inviter: Pick<
          User,
          "id" | "username" | "firstName" | "lastName"
        > | null;
      };
    }
  | {
      valid: false;
      error: string;
      code: "INVALID_TOKEN" | "EXPIRED" | "ALREADY_ACCEPTED";
    };

export type CreateInviteResult =
  | { success: true; invite: Invite }
  | { success: false; error: string; code: string };

/**
 * Validate an invite token
 * Returns invite details if valid, error if not
 */
export async function validateInviteToken(
  token: string,
): Promise<InviteValidationResult> {
  const invite = await db.invite.findUnique({
    where: { token },
    include: {
      inviter: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!invite) {
    return {
      valid: false,
      error: "Invalid invite token",
      code: "INVALID_TOKEN",
    };
  }

  if (invite.status === "accepted") {
    return {
      valid: false,
      error: "This invite has already been used",
      code: "ALREADY_ACCEPTED",
    };
  }

  if (isInviteExpired(invite.expiresAt)) {
    return {
      valid: false,
      error: "This invite has expired",
      code: "EXPIRED",
    };
  }

  return { valid: true, invite };
}

/**
 * Create a user-to-user invite
 */
export async function createUserInvite(
  inviterId: string,
  email: string,
): Promise<CreateInviteResult> {
  const normalizedEmail = normalizeEmail(email);

  // Validate email format and disposable check
  const emailValidation = validateEmail(normalizedEmail);
  if (!emailValidation.valid) {
    return {
      success: false,
      error: emailValidation.error ?? "Invalid email",
      code: "INVALID_EMAIL",
    };
  }

  // Check if user has invites remaining
  const inviter = await db.user.findUnique({
    where: { id: inviterId },
    select: { invitesRemaining: true },
  });

  if (!inviter) {
    return { success: false, error: "User not found", code: "USER_NOT_FOUND" };
  }

  if (inviter.invitesRemaining <= 0) {
    return {
      success: false,
      error: "No invites remaining",
      code: "NO_INVITES_REMAINING",
    };
  }

  // Check if email already has an account
  const existingUser = await db.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    return {
      success: false,
      error: "This email already has an account",
      code: "ALREADY_HAS_ACCOUNT",
    };
  }

  // Check if this user already invited this email
  const existingInvite = await db.invite.findUnique({
    where: {
      inviterId_email: {
        inviterId,
        email: normalizedEmail,
      },
    },
  });

  if (existingInvite) {
    // If pending and not expired, return error
    if (
      existingInvite.status === "pending" &&
      !isInviteExpired(existingInvite.expiresAt)
    ) {
      return {
        success: false,
        error: "You have already invited this email",
        code: "ALREADY_INVITED",
      };
    }
    // If accepted, return error
    if (existingInvite.status === "accepted") {
      return {
        success: false,
        error: "This person has already joined",
        code: "ALREADY_JOINED",
      };
    }
    // If expired, we'll allow creating a new invite below
  }

  // Create invite and decrement user's invite count in a transaction
  const invite = await db.$transaction(async (tx) => {
    // Decrement invites remaining
    await tx.user.update({
      where: { id: inviterId },
      data: { invitesRemaining: { decrement: 1 } },
    });

    // Create invite
    return tx.invite.create({
      data: {
        email: normalizedEmail,
        token: generateInviteToken(),
        type: "user",
        expiresAt: getInviteExpiryDate(),
        inviterId,
      },
    });
  });

  return { success: true, invite };
}

/**
 * Accept an invite (mark as accepted)
 */
export async function acceptInvite(token: string): Promise<Invite | null> {
  const invite = await db.invite.update({
    where: { token },
    data: {
      status: "accepted",
      acceptedAt: new Date(),
    },
  });

  return invite;
}

/**
 * Get user's sent invites with status
 */
export async function getUserInvites(userId: string) {
  const invites = await db.invite.findMany({
    where: { inviterId: userId },
    orderBy: { createdAt: "desc" },
  });

  // Derive effective status (check expiry for pending invites)
  return invites.map((invite) => ({
    ...invite,
    effectiveStatus: getEffectiveStatus(invite),
  }));
}

/**
 * Get effective invite status (accounts for expiry)
 */
function getEffectiveStatus(
  invite: Pick<Invite, "status" | "expiresAt">,
): "pending" | "accepted" | "expired" {
  if (invite.status === "accepted") return "accepted";
  if (isInviteExpired(invite.expiresAt)) return "expired";
  return "pending";
}

/**
 * Get the invite URL for a token
 */
export function getInviteUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3300";
  return `${baseUrl}/join?token=${token}`;
}
