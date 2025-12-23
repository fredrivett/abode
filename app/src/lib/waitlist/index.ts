import db from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { getWaitlistConfirmationEmail } from "@/lib/email/templates";
import {
  isDisposableEmail,
  isValidEmail,
} from "@/lib/invites/email-validation";
import { createLogger } from "@/lib/logger.server";

const log = createLogger("lib/waitlist");

export type WaitlistResult =
  | { success: true; position: number }
  | { success: false; error: string };

/**
 * Add an email to the waitlist
 */
export async function joinWaitlist(
  email: string,
  referralSource?: string,
): Promise<WaitlistResult> {
  // Validate email format
  if (!isValidEmail(email)) {
    return { success: false, error: "Please enter a valid email address" };
  }

  // Block disposable emails
  if (isDisposableEmail(email)) {
    return {
      success: false,
      error: "Please use a permanent email address",
    };
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check if already on waitlist
  const existing = await db.waitlistEntry.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    return {
      success: false,
      error: "This email is already on the waitlist",
    };
  }

  // Check if already a user
  const existingUser = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingUser) {
    return {
      success: false,
      error: "This email is already registered",
    };
  }

  // Check if there's already an active invite for this email
  const existingInvite = await db.invite.findFirst({
    where: {
      email: normalizedEmail,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  if (existingInvite) {
    return {
      success: false,
      error: "You already have a pending invite — check your email",
    };
  }

  // Create waitlist entry with position assignment in a transaction
  const entry = await db.$transaction(async (tx) => {
    // Get current max position
    const maxPosition = await tx.waitlistEntry.aggregate({
      _max: { position: true },
    });

    const position = (maxPosition._max.position ?? 0) + 1;

    // Create waitlist entry
    return tx.waitlistEntry.create({
      data: {
        email: normalizedEmail,
        position,
        referralSource,
      },
    });
  });

  log.info(
    { email: normalizedEmail, position: entry.position },
    "Added to waitlist",
  );

  // Send confirmation email
  const { subject, text } = getWaitlistConfirmationEmail({
    position: entry.position ?? undefined,
  });

  const emailResult = await sendEmail({
    to: normalizedEmail,
    subject,
    text,
  });

  if (!emailResult.success) {
    log.warn(
      { email: normalizedEmail, error: emailResult.error },
      "Failed to send waitlist confirmation email",
    );
  }

  return { success: true, position: entry.position ?? 0 };
}

/**
 * Get waitlist statistics
 */
export async function getWaitlistStats() {
  const [total, recentSignups] = await Promise.all([
    db.waitlistEntry.count(),
    db.waitlistEntry.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
    }),
  ]);

  return { total, recentSignups };
}
