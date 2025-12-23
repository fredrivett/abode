import { getInviteUrl } from "@/lib/invites";

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
 * Email template for user-to-user invites
 */
export function getUserInviteEmail(options: {
  inviterName: string;
  inviteToken: string;
}): { subject: string; text: string } {
  const inviteUrl = getInviteUrl(options.inviteToken);

  const subject = `${options.inviterName} invited you to join abode`;

  const text = `${options.inviterName} thinks you'd love abode!

${ABODE_DESCRIPTION}

click here to accept your invite and create your account:
${inviteUrl}

this invite link expires in 7 days.

${EMAIL_FOOTER}
`;

  return { subject, text };
}

/**
 * Email template for waitlist confirmation
 */
export function getWaitlistConfirmationEmail(options: { position?: number }): {
  subject: string;
  text: string;
} {
  const subject = "you're on the abode waitlist";

  let positionText = "";
  if (options.position && options.position >= 50) {
    positionText = `you're #${options.position} in line. `;
  }

  const text = `you're on the list!

${positionText}we'll email you when it's your turn to join abode.

in the meantime, follow us for updates:
${ABODE_TWITTER_URL}

what is abode?
${ABODE_DESCRIPTION}

${EMAIL_FOOTER}
`;

  return { subject, text };
}

/**
 * Email template for waitlist promotion (when admin invites from waitlist)
 */
export function getWaitlistInviteEmail(options: { inviteToken: string }): {
  subject: string;
  text: string;
} {
  const inviteUrl = getInviteUrl(options.inviteToken);

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

  return { subject, text };
}
