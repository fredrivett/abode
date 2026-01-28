import { getInviteUrl } from "@/lib/invites";
import { getAppBaseUrl } from "@/lib/url";

/**
 * Shared constants for email templates
 */
export const ABODE_TWITTER_URL = "https://twitter.com/abodefyi";
export const ABODE_TAGLINE = "your digital home";
export const ABODE_DESCRIPTION =
  "abode is your digital home — the place to store what matters and share a subset of that with the world.";

const EMAIL_FOOTER = `---
abode — ${ABODE_TAGLINE}`;

/**
 * HTML helper functions for consistent styling across all emails
 */
function htmlLink(text: string, url: string): string {
  return `<a href="${url}" style="text-decoration: underline;">${text}</a>`;
}

function htmlFooter(): string {
  return `<p style="color: #666; border-top: 1px solid #ddd; padding-top: 1em; margin-top: 2em;">
abode — ${ABODE_TAGLINE}
</p>`;
}

/**
 * Email template for user-to-user invites
 */
export function getUserInviteEmail(options: {
  inviterName: string;
  inviteToken: string;
}): { subject: string; text: string; html: string } {
  const inviteUrl = getInviteUrl(options.inviteToken);
  const websiteUrl = getAppBaseUrl();

  const subject = `${options.inviterName} invited you to join abode`;

  const text = `${options.inviterName} thinks you'd love abode!

${ABODE_DESCRIPTION}

click here to accept your invite and create your account:
${inviteUrl}

this invite link expires in 7 days.

${EMAIL_FOOTER}
`;

  // HTML version with link on first "abode" in description
  const descriptionWithLink = ABODE_DESCRIPTION.replace(
    "abode",
    htmlLink("abode", websiteUrl),
  );

  const html = `<p>${options.inviterName} thinks you'd love abode!</p>

<p>${descriptionWithLink}</p>

<p>click here to accept your invite and create your account:<br>
${htmlLink(inviteUrl, inviteUrl)}</p>

<p>this invite link expires in 7 days.</p>

${htmlFooter()}`;

  return { subject, text, html };
}

/**
 * Email template for waitlist confirmation
 */
export function getWaitlistConfirmationEmail(options: { position?: number }): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "you're on the abode waitlist";

  let positionText = "";
  let positionHtml = "";
  if (options.position && options.position >= 50) {
    positionText = `you're #${options.position} in line. `;
    positionHtml = `<p>you're #${options.position} in line.</p>\n\n`;
  }

  const text = `you're on the list!

${positionText}we'll email you when it's your turn to join abode.

in the meantime, follow us for updates:
${ABODE_TWITTER_URL}

${EMAIL_FOOTER}
`;

  const html = `<p>you're on the list!</p>

${positionHtml}<p>we'll email you when it's your turn to join abode.</p>

<p>in the meantime, ${htmlLink("follow us for updates", ABODE_TWITTER_URL)}.</p>

${htmlFooter()}`;

  return { subject, text, html };
}

/**
 * Email template for waitlist promotion (when admin invites from waitlist)
 */
export function getWaitlistInviteEmail(options: { inviteToken: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const inviteUrl = getInviteUrl(options.inviteToken);
  const websiteUrl = getAppBaseUrl();

  const subject = "you're in! your abode invite is ready";

  const text = `thanks for waiting — your exclusive access is ready!

you've been invited to join abode. click here to create your account:
${inviteUrl}

this invite link expires in 7 days.

we're in the early days and would love your feedback — just reply to this email with any thoughts.

we're excited to have you!

fred (founder @ abode)

${EMAIL_FOOTER}
`;

  const html = `<p>thanks for waiting — your exclusive access is ready!</p>

<p>you've been invited to join ${htmlLink("abode", websiteUrl)}. ${htmlLink("click here", inviteUrl)} to create your account.</p>

<p>this invite link expires in 7 days.</p>

<p>we're in the early days and would love your feedback — just reply to this email with any thoughts.</p>

<p>we're excited to have you!</p>

<p>fred (founder @ abode)</p>

${htmlFooter()}`;

  return { subject, text, html };
}

/**
 * Admin notification types
 */
export type AdminNotificationType =
  | "waitlist_signup"
  | "user_invited"
  | "account_created"
  | "account_deleted";

export type AdminNotificationData =
  | {
      type: "waitlist_signup";
      email: string;
      position: number;
      referralSource?: string;
    }
  | {
      type: "user_invited";
      inviterEmail: string;
      inviterUsername: string;
      inviteeEmail: string;
    }
  | {
      type: "account_created";
      email: string;
      username: string;
      origin: "user" | "waitlist" | "admin" | "direct";
      inviterUsername?: string;
      inviterEmail?: string;
    }
  | {
      type: "account_deleted";
      email: string;
      username: string;
      deletedBy: "self" | "admin";
      adminEmail?: string;
    };

/**
 * Email template for admin notifications
 */
export function getAdminNotificationEmail(data: AdminNotificationData): {
  subject: string;
  text: string;
  html: string;
} {
  switch (data.type) {
    case "waitlist_signup": {
      const subject = `[abode] waitlist signup: ${data.email}`;
      const refInfo = data.referralSource
        ? `\nreferral source: ${data.referralSource}`
        : "";

      const text = `new waitlist signup

email: ${data.email}
position: #${data.position}${refInfo}

${EMAIL_FOOTER}
`;

      const html = `<p><strong>new waitlist signup</strong></p>

<p>
<strong>email:</strong> ${data.email}<br>
<strong>position:</strong> #${data.position}${data.referralSource ? `<br><strong>referral source:</strong> ${data.referralSource}` : ""}
</p>

${htmlFooter()}`;

      return { subject, text, html };
    }

    case "user_invited": {
      const subject = `[abode] invite sent: ${data.inviterUsername} → ${data.inviteeEmail}`;

      const text = `user invite sent

${data.inviterUsername} (${data.inviterEmail}) invited:
${data.inviteeEmail}

${EMAIL_FOOTER}
`;

      const html = `<p><strong>user invite sent</strong></p>

<p>
<strong>${data.inviterUsername}</strong> (${data.inviterEmail}) invited:<br>
${data.inviteeEmail}
</p>

${htmlFooter()}`;

      return { subject, text, html };
    }

    case "account_created": {
      const inviteInfo =
        data.origin === "user" && data.inviterUsername
          ? ` (invited by ${data.inviterUsername})`
          : data.origin === "waitlist"
            ? " (from waitlist)"
            : data.origin === "admin"
              ? " (admin invite)"
              : "";

      const subject = `[abode] new account: ${data.username}${inviteInfo}`;

      let text = `new account created

email: ${data.email}
username: ${data.username}
origin: ${data.origin}`;

      if (data.origin === "user" && data.inviterUsername) {
        text += `\ninvited by: ${data.inviterUsername} (${data.inviterEmail})`;
      }

      text += `\n\n${EMAIL_FOOTER}\n`;

      let html = `<p><strong>new account created</strong></p>

<p>
<strong>email:</strong> ${data.email}<br>
<strong>username:</strong> ${data.username}<br>
<strong>origin:</strong> ${data.origin}`;

      if (data.origin === "user" && data.inviterUsername) {
        html += `<br><strong>invited by:</strong> ${data.inviterUsername} (${data.inviterEmail})`;
      }

      html += `</p>

${htmlFooter()}`;

      return { subject, text, html };
    }

    case "account_deleted": {
      const deletedByInfo =
        data.deletedBy === "admin" && data.adminEmail
          ? ` by admin (${data.adminEmail})`
          : " (self-deleted)";

      const subject = `[abode] account deleted: ${data.username}${deletedByInfo}`;

      let text = `account deleted

email: ${data.email}
username: ${data.username}
deleted by: ${data.deletedBy}`;

      if (data.deletedBy === "admin" && data.adminEmail) {
        text += `\nadmin: ${data.adminEmail}`;
      }

      text += `\n\n${EMAIL_FOOTER}\n`;

      let html = `<p><strong>account deleted</strong></p>

<p>
<strong>email:</strong> ${data.email}<br>
<strong>username:</strong> ${data.username}<br>
<strong>deleted by:</strong> ${data.deletedBy}`;

      if (data.deletedBy === "admin" && data.adminEmail) {
        html += `<br><strong>admin:</strong> ${data.adminEmail}`;
      }

      html += `</p>

${htmlFooter()}`;

      return { subject, text, html };
    }
  }
}

/**
 * Email template for user account deletion confirmation
 */
export function getUserAccountDeletionEmail(): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "your abode account has been deleted";

  const text = `your abode account has been permanently deleted.

all of your data has been removed from our systems.

if you did not request this deletion, please contact us immediately at fred@abode.fyi.

we're sorry to see you go.

${EMAIL_FOOTER}
`;

  const html = `<p>your abode account has been permanently deleted.</p>

<p>all of your data has been removed from our systems.</p>

<p><strong>if you did not request this deletion, please contact us immediately at ${htmlLink("fred@abode.fyi", "mailto:fred@abode.fyi")}.</strong></p>

<p>we're sorry to see you go.</p>

${htmlFooter()}`;

  return { subject, text, html };
}
