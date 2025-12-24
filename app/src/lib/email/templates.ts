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
  const websiteUrl = getAppBaseUrl();

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

  const descriptionWithLink = ABODE_DESCRIPTION.replace(
    "abode",
    htmlLink("abode", websiteUrl),
  );

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
