import type { Invite, InviteOrigin, User } from "@prisma/client";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { getAppBaseUrl } from "@/lib/url";
import { normalizeEmail, validateEmail } from "./email-validation";
import {
  generateInviteToken,
  getInviteExpiryDate,
  isInviteExpired,
} from "./token";

const log = createLogger("lib/invites");

export { normalizeEmail, validateEmail } from "./email-validation";
export {
  generateInviteToken,
  getInviteExpiryDate,
  isInviteExpired,
} from "./token";

/**
 * Get the number of invites a user has available
 * Available = allocation - (accepted + active pending)
 */
export async function getAvailableInvites(userId: string): Promise<number> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { inviteAllocation: true },
  });

  if (!user) return 0;

  // Count invites that are "used" (accepted or still active/pending)
  const usedInvites = await db.invite.count({
    where: {
      inviterId: userId,
      OR: [
        { status: "accepted" },
        { status: "pending", expiresAt: { gt: new Date() } },
      ],
    },
  });

  return Math.max(0, user.inviteAllocation - usedInvites);
}

/**
 * Invite context returned on validation errors (for EXPIRED and ALREADY_ACCEPTED)
 * Allows UI to show helpful context like who invited them
 */
export type InviteErrorContext = {
  email: string;
  origin: InviteOrigin;
  expiresAt: Date;
  createdAt: Date;
  inviter: Pick<User, "username" | "avatarUrl"> | null;
};

/**
 * Result types for invite operations
 */
export type InviteValidationResult =
  | {
      valid: true;
      invite: Invite & {
        inviter: Pick<
          User,
          "id" | "username" | "firstName" | "lastName" | "avatarUrl"
        > | null;
      };
    }
  | {
      valid: false;
      error: string;
      code: "INVALID_TOKEN";
    }
  | {
      valid: false;
      error: string;
      code: "EXPIRED" | "ALREADY_ACCEPTED";
      invite: InviteErrorContext;
    };

export type CreateInviteResult =
  | { success: true; invite: Invite }
  | { success: false; error: string; code: string };

/**
 * Validate an invite token
 * Returns invite details if valid, error with context if not
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
          avatarUrl: true,
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

  // Build invite context for error responses
  const inviteContext: InviteErrorContext = {
    email: invite.email,
    origin: invite.origin,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
    inviter: invite.inviter
      ? {
          username: invite.inviter.username,
          avatarUrl: invite.inviter.avatarUrl,
        }
      : null,
  };

  if (invite.status === "accepted") {
    return {
      valid: false,
      error: "This invite has already been used",
      code: "ALREADY_ACCEPTED",
      invite: inviteContext,
    };
  }

  if (isInviteExpired(invite.expiresAt)) {
    return {
      valid: false,
      error: "This invite has expired",
      code: "EXPIRED",
      invite: inviteContext,
    };
  }

  return { valid: true, invite };
}

/**
 * Create a user-to-user invite
 * Uses a transaction to prevent race conditions when checking/creating invites
 */
export async function createUserInvite(
  inviterId: string,
  email: string,
): Promise<CreateInviteResult> {
  const normalizedEmail = normalizeEmail(email);

  // Validate email format and disposable check (outside transaction - no DB needed)
  const emailValidation = validateEmail(normalizedEmail);
  if (!emailValidation.valid) {
    return {
      success: false,
      error: emailValidation.error ?? "Invalid email",
      code: "INVALID_EMAIL",
    };
  }

  // Use transaction to prevent race conditions
  return db.$transaction(async (tx) => {
    // Check if user exists and get allocation
    const user = await tx.user.findUnique({
      where: { id: inviterId },
      select: { id: true, inviteAllocation: true },
    });

    if (!user) {
      return {
        success: false,
        error: "User not found",
        code: "USER_NOT_FOUND",
      };
    }

    // Count used invites within transaction
    const usedInvites = await tx.invite.count({
      where: {
        inviterId,
        OR: [
          { status: "accepted" },
          { status: "pending", expiresAt: { gt: new Date() } },
        ],
      },
    });

    const availableInvites = Math.max(0, user.inviteAllocation - usedInvites);

    // Check if email already has an account
    const existingUser = await tx.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      return {
        success: false,
        error: "This email already has an account",
        code: "ALREADY_HAS_ACCOUNT",
      };
    }

    // Check if this user already invited this email
    const existingInvite = await tx.invite.findUnique({
      where: {
        inviterId_email: {
          inviterId,
          email: normalizedEmail,
        },
      },
    });

    if (existingInvite) {
      // If accepted, return error
      if (existingInvite.status === "accepted") {
        return {
          success: false,
          error: "This person has already joined",
          code: "ALREADY_JOINED",
        };
      }

      // If pending (expired or not), refresh the invite with new token/expiry
      // This is a re-send, so no invite credit cost
      const invite = await tx.invite.update({
        where: { id: existingInvite.id },
        data: {
          token: generateInviteToken(),
          expiresAt: getInviteExpiryDate(),
          sendCount: { increment: 1 },
        },
      });

      return { success: true, invite };
    }

    // Check available invites (after re-send check, since re-sends don't cost)
    if (availableInvites <= 0) {
      return {
        success: false,
        error: "No invites remaining",
        code: "NO_INVITES_REMAINING",
      };
    }

    // Create new invite
    const invite = await tx.invite.create({
      data: {
        email: normalizedEmail,
        token: generateInviteToken(),
        origin: "user",
        expiresAt: getInviteExpiryDate(),
        inviterId,
      },
    });

    return { success: true, invite };
  });
}

export type AcceptInviteResult =
  | { success: true; invite: Invite }
  | { success: false; error: string; code: string };

/**
 * Accept an invite (mark as accepted)
 * Validates that the invite exists, is not expired, and hasn't been accepted
 */
export async function acceptInvite(token: string): Promise<AcceptInviteResult> {
  log.info({ token: `${token.substring(0, 8)}...` }, "acceptInvite called");

  const invite = await db.invite.findUnique({
    where: { token },
  });

  log.info(
    {
      inviteFound: !!invite,
      inviteId: invite?.id,
      inviteStatus: invite?.status,
      inviteEmail: invite?.email,
      inviteExpired: invite ? isInviteExpired(invite.expiresAt) : null,
    },
    "Looked up invite for acceptance",
  );

  if (!invite) {
    log.error({ token: `${token.substring(0, 8)}...` }, "Invite not found for acceptance");
    return {
      success: false,
      error: "Invalid invite token",
      code: "INVALID_TOKEN",
    };
  }

  if (invite.status === "accepted") {
    log.warn({ inviteId: invite.id, email: invite.email }, "Invite already accepted");
    return {
      success: false,
      error: "Invite already accepted",
      code: "ALREADY_ACCEPTED",
    };
  }

  if (isInviteExpired(invite.expiresAt)) {
    log.warn(
      { inviteId: invite.id, expiresAt: invite.expiresAt },
      "Attempted to accept expired invite",
    );
    return { success: false, error: "Invite has expired", code: "EXPIRED" };
  }

  log.info({ inviteId: invite.id, email: invite.email }, "Updating invite status to accepted");
  const updatedInvite = await db.invite.update({
    where: { token },
    data: {
      status: "accepted",
      acceptedAt: new Date(),
    },
  });
  log.info(
    { inviteId: updatedInvite.id, acceptedAt: updatedInvite.acceptedAt },
    "Invite successfully marked as accepted",
  );

  return { success: true, invite: updatedInvite };
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
  const baseUrl = getAppBaseUrl();
  return `${baseUrl}/join?token=${token}`;
}

export type RevokeInviteResult =
  | { success: true }
  | { success: false; error: string; code: string };

/**
 * Revoke (delete) an invite
 * Only the inviter can revoke their own invites
 * Can only revoke pending invites (not accepted ones)
 */
export async function revokeInvite(
  inviteId: string,
  userId: string,
): Promise<RevokeInviteResult> {
  // Find the invite and check ownership
  const invite = await db.invite.findUnique({
    where: { id: inviteId },
    select: {
      id: true,
      inviterId: true,
      status: true,
    },
  });

  if (!invite) {
    return {
      success: false,
      error: "Invite not found",
      code: "INVITE_NOT_FOUND",
    };
  }

  // Check if user owns this invite
  if (invite.inviterId !== userId) {
    return {
      success: false,
      error: "You can only revoke your own invites",
      code: "UNAUTHORIZED",
    };
  }

  // Don't allow revoking accepted invites
  if (invite.status === "accepted") {
    return {
      success: false,
      error: "Cannot revoke an accepted invite",
      code: "ALREADY_ACCEPTED",
    };
  }

  // Delete the invite
  await db.invite.delete({
    where: { id: inviteId },
  });

  return { success: true };
}

/**
 * Create a waitlist invite (admin inviting from waitlist)
 */
export async function createWaitlistInvite(
  waitlistEntryId: string,
): Promise<CreateInviteResult> {
  // Get the waitlist entry
  const entry = await db.waitlistEntry.findUnique({
    where: { id: waitlistEntryId },
    include: {
      invites: {
        where: {
          OR: [
            { acceptedAt: { not: null } },
            { expiresAt: { gt: new Date() } },
          ],
        },
        take: 1,
      },
    },
  });

  if (!entry) {
    return {
      success: false,
      error: "Waitlist entry not found",
      code: "ENTRY_NOT_FOUND",
    };
  }

  // Check if already invited or joined
  if (entry.invites.length > 0) {
    const invite = entry.invites[0];
    if (invite.acceptedAt) {
      return {
        success: false,
        error: "This person has already joined",
        code: "ALREADY_JOINED",
      };
    }
    return {
      success: false,
      error: "This person already has an active invite",
      code: "ALREADY_INVITED",
    };
  }

  // Check if email already has an account
  const existingUser = await db.user.findUnique({
    where: { email: entry.email },
  });

  if (existingUser) {
    return {
      success: false,
      error: "This email already has an account",
      code: "ALREADY_HAS_ACCOUNT",
    };
  }

  // Create the invite
  const invite = await db.invite.create({
    data: {
      email: entry.email,
      token: generateInviteToken(),
      origin: "waitlist",
      expiresAt: getInviteExpiryDate(),
      waitlistEntryId: entry.id,
    },
  });

  return { success: true, invite };
}
