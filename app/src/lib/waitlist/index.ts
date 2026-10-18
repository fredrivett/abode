import { tasks } from "@trigger.dev/sdk";
import { systemDb } from "@/lib/db";
import { EmailBlockedInTestError, sendEmail } from "@/lib/email";
import { getWaitlistConfirmationEmail } from "@/lib/email/templates";
import {
  isDisposableEmail,
  isValidEmail,
} from "@/lib/invites/email-validation";
import { createLogger } from "@/lib/logger.server";
import { getPostHogClient } from "@/lib/posthog-server";
import type { adminNotificationTask } from "../../../trigger/admin-notification";

const log = createLogger("lib/waitlist");

export type WaitlistResult =
  | { success: true; position: number }
  | { success: false; error: string };

/** Where a waitlist join came from: the waitlist form, or a shared item's save button */
export type WaitlistJoinSource = "form" | "share";

/**
 * Add an email to the waitlist.
 *
 * Records `waitlist_joined` server-side so a join is counted even when the
 * visitor blocks analytics. Pass the browser's PostHog `distinctId` to attach
 * it to their visit (and its funnel); without one it's a personless event.
 */
export async function joinWaitlist({
  email,
  referralSource,
  source,
  distinctId,
  sourcePath,
}: {
  email: string;
  referralSource?: string;
  source: WaitlistJoinSource;
  distinctId?: string;
  sourcePath?: string;
}): Promise<WaitlistResult> {
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
  const existing = await systemDb.waitlistEntry.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    return {
      success: false,
      error: "This email is already on the waitlist",
    };
  }

  // Check if already a user
  const existingUser = await systemDb.user.findUnique({
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
  const existingInvite = await systemDb.invite.findFirst({
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
  const entry = await systemDb.$transaction(async (tx) => {
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
  const { subject, text, html } = getWaitlistConfirmationEmail({
    position: entry.position ?? undefined,
  });

  try {
    const emailResult = await sendEmail({
      to: normalizedEmail,
      subject,
      text,
      html,
    });

    if (!emailResult.success) {
      log.warn(
        { email: normalizedEmail, error: emailResult.error },
        "Failed to send waitlist confirmation email",
      );
    }
  } catch (error) {
    // EmailBlockedInTestError is expected in tests - treat as success
    if (!(error instanceof EmailBlockedInTestError)) {
      log.warn(
        { email: normalizedEmail, error },
        "Failed to send waitlist confirmation email",
      );
    }
  }

  // Trigger admin notification (skip in test environment)
  if (process.env.VITEST) {
    log.debug(
      { email: normalizedEmail },
      "Skipping admin notification in test environment",
    );
  } else {
    try {
      await tasks.trigger<typeof adminNotificationTask>("admin-notification", {
        type: "waitlist_signup",
        email: normalizedEmail,
        position: entry.position ?? 0,
        referralSource,
      });
    } catch (error) {
      log.warn(
        { error },
        "Failed to trigger admin notification for waitlist signup",
      );
    }
  }

  // Awaited so a short-lived function can't freeze before it's sent; a
  // telemetry failure must never fail the join itself
  try {
    await getPostHogClient()?.captureImmediate({
      distinctId: distinctId ?? `waitlist_${entry.id}`,
      event: "waitlist_joined",
      properties: {
        source,
        source_path: sourcePath,
        // No browser visit to attach to, so don't create a person for it
        ...(distinctId ? {} : { $process_person_profile: false }),
      },
    });
  } catch (error) {
    log.warn({ error }, "Failed to record waitlist_joined");
  }

  return { success: true, position: entry.position ?? 0 };
}

/**
 * Get waitlist statistics
 */
export async function getWaitlistStats() {
  const [total, recentSignups] = await Promise.all([
    systemDb.waitlistEntry.count(),
    systemDb.waitlistEntry.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
    }),
  ]);

  return { total, recentSignups };
}
