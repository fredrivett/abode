/**
 * Share invites: a reader of someone's shared item asks to join, using one of
 * the sharer's invites (their regular allocation), and gets that item saved to
 * their new abode once they're in. When the sharer has no invites left — or has
 * turned this off — the reader joins the waitlist, credited to the sharer.
 *
 * The invite token goes straight back to the requester (rather than only by
 * email, like a regular invite) so they can sign up without leaving the page.
 * That's safe because an invite only completes for its own email address:
 * signup confirms the address by email, and completeSignup rejects a token
 * used by any other email.
 */

import db from "@/lib/db";
import {
  EmailBlockedInTestError,
  isEmailConfigured,
  sendEmail,
} from "@/lib/email";
import { getUserInviteEmail } from "@/lib/email/templates";
import { canViewItem, itemAccessSelect } from "@/lib/items/access";
import { createItemFromUrl } from "@/lib/items/from-url";
import { createLogger } from "@/lib/logger.server";
import { isCanonicalUuid } from "@/lib/pagination";
import { captureServerException } from "@/lib/posthog-server";
import { guardDailyLimit } from "@/lib/usage-limits";
import { joinWaitlist } from "@/lib/waitlist";
import {
  createUserInvite,
  getAvailableInvites,
  normalizeEmail,
  validateEmail,
} from "./index";

const log = createLogger("lib/invites/share-invite");

export type ShareInviteOutcome =
  /** Invite created from the sharer; continue to the join page */
  | { status: "invited"; joinPath: string }
  /** Sharer has no invites (or opted out); added to the waitlist */
  | { status: "waitlisted" }
  /** The email already has an account; log in and save instead */
  | { status: "has_account" }
  | { status: "invalid_email"; error: string }
  /** The item isn't publicly viewable (or doesn't exist) */
  | { status: "unavailable" };

/** Waitlist referral source crediting the sharer, e.g. "share:@fred". */
export function shareReferralSource(username: string | null): string {
  return username ? `share:@${username}` : "share";
}

/** Join page for a share invite, carrying the item to save after signup. */
export function shareJoinPath({
  token,
  itemId,
}: {
  token: string;
  itemId: string;
}): string {
  return `/join?${new URLSearchParams({ token, save: itemId })}`;
}

const shareItemSelect = {
  ...itemAccessSelect,
  id: true,
  title: true,
  sourceUrl: true,
  user: {
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      allowShareInvites: true,
    },
  },
} as const;

async function findPublicItem(itemId: string) {
  if (!isCanonicalUuid(itemId)) return null;
  const item = await db.item.findUnique({
    where: { id: itemId },
    select: shareItemSelect,
  });
  // Anonymous viewer: only shared / public-room items qualify
  return item && canViewItem(item, null) ? item : null;
}

/**
 * A publicly viewable item with a link to save, or null. Used to show what will
 * be saved on the join page and to save it once signup completes.
 */
export async function getSaveableSharedItem(
  itemId: string,
): Promise<{ id: string; title: string | null; sourceUrl: string } | null> {
  const item = await findPublicItem(itemId);
  if (!item?.sourceUrl) return null;
  return { id: item.id, title: item.title, sourceUrl: item.sourceUrl };
}

/**
 * Whether a reader can join right now with this sharer's invite (they allow it
 * and have one left); otherwise the CTA offers the waitlist.
 */
export async function shareInvitesOpen(user: {
  id: string;
  allowShareInvites: boolean;
}): Promise<boolean> {
  if (!user.allowShareInvites) return false;
  return (await getAvailableInvites(user.id)) > 0;
}

function displayName(user: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return name || user.username || "Someone";
}

/**
 * Handle a reader's request to join from a shared item. Never throws for
 * expected outcomes; see {@link ShareInviteOutcome}.
 */
export async function requestShareInvite({
  itemId,
  email,
}: {
  itemId: string;
  email: string;
}): Promise<ShareInviteOutcome> {
  const item = await findPublicItem(itemId);
  if (!item) return { status: "unavailable" };

  const validation = validateEmail(email);
  if (!validation.valid) {
    return {
      status: "invalid_email",
      error: validation.error ?? "Invalid email",
    };
  }
  const normalizedEmail = normalizeEmail(email);

  const existingUser = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existingUser) return { status: "has_account" };

  const sharer = item.user;
  if (sharer.allowShareInvites) {
    const result = await createUserInvite(sharer.id, normalizedEmail);
    if (result.success) {
      await sendInviteEmail({
        email: normalizedEmail,
        inviterName: displayName(sharer),
        token: result.invite.token,
        itemId,
      });
      return {
        status: "invited",
        joinPath: shareJoinPath({ token: result.invite.token, itemId }),
      };
    }
    if (result.code === "ALREADY_HAS_ACCOUNT") return { status: "has_account" };
    if (result.code === "INVALID_EMAIL") {
      return { status: "invalid_email", error: result.error };
    }
    // Out of invites (or anything else unexpected): fall back to the waitlist
    log.info(
      { sharerId: sharer.id, code: result.code },
      "Share invite unavailable, falling back to waitlist",
    );
  }

  const alreadyWaiting = await db.waitlistEntry.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (alreadyWaiting) return { status: "waitlisted" };

  const waitlist = await joinWaitlist(
    normalizedEmail,
    shareReferralSource(sharer.username),
  );
  if (!waitlist.success) {
    return { status: "invalid_email", error: waitlist.error };
  }
  return { status: "waitlisted" };
}

// Best-effort backup so the reader can come back to the invite later; they're
// sent straight to the join page either way, so a failed email isn't fatal
async function sendInviteEmail({
  email,
  inviterName,
  token,
  itemId,
}: {
  email: string;
  inviterName: string;
  token: string;
  itemId: string;
}) {
  if (!isEmailConfigured()) {
    log.info("Email not configured, skipping share invite email");
    return;
  }
  const { subject, text, html } = getUserInviteEmail({
    inviterName,
    inviteToken: token,
    saveItemId: itemId,
  });
  try {
    const result = await sendEmail({ to: email, subject, text, html });
    if (!result.success) {
      log.warn({ error: result.error }, "Failed to send share invite email");
    }
  } catch (error) {
    // EmailBlockedInTestError is expected in tests
    if (!(error instanceof EmailBlockedInTestError)) {
      log.warn({ error }, "Failed to send share invite email");
    }
  }
}

/**
 * Save a shared item's link into a new user's abode after signup. Best-effort:
 * returns the new item's id, or null when there's nothing to save or it fails —
 * signup must never fail because of this.
 */
export async function saveSharedItemForNewUser({
  userId,
  itemId,
}: {
  userId: string;
  itemId: string;
}): Promise<string | null> {
  try {
    const shared = await getSaveableSharedItem(itemId);
    if (!shared) {
      log.info({ userId, itemId }, "Shared item not saveable, skipping");
      return null;
    }
    // Idempotent: a replayed or concurrent signup completion (e.g. the
    // confirmation link opened twice) reuses the item it already saved
    const existing = await db.item.findFirst({
      where: { userId, sourceUrl: shared.sourceUrl },
      select: { id: true },
    });
    if (existing) return existing.id;

    const guard = await guardDailyLimit(userId, "ingestion");
    if (!guard.ok) return null;
    const item = await createItemFromUrl({
      userId,
      url: shared.sourceUrl,
      source: "web",
    });
    return item.id;
  } catch (error) {
    log.warn({ error, userId, itemId }, "Failed to save shared item");
    captureServerException(error, userId, {
      route: "saveSharedItemForNewUser",
    });
    return null;
  }
}
