import { Resend } from "resend";
import { env } from "@/env";
import { createLogger } from "@/lib/logger.server";

const log = createLogger("lib/email");

/**
 * Custom error thrown when trying to send email in test environment
 * Callers should catch this and treat as success in tests
 */
export class EmailBlockedInTestError extends Error {
  constructor(to: string) {
    super(`Email to ${to} blocked in test environment`);
    this.name = "EmailBlockedInTestError";
  }
}

// Lazy initialization of Resend client
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
}

/**
 * Email configuration
 */
const EMAIL_CONFIG = {
  from: env.RESEND_FROM_EMAIL || "fred @ abode <fred@abode.fyi>",
  replyTo: env.RESEND_REPLY_TO_EMAIL,
};

export type SendEmailResult =
  | { success: true; id: string }
  | { success: false; error: string };

/**
 * Send an email using Resend
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendEmailResult> {
  // Block emails in test environment
  if (process.env.VITEST) {
    throw new EmailBlockedInTestError(options.to);
  }

  try {
    const resend = getResendClient();

    const { data, error } = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      replyTo: EMAIL_CONFIG.replyTo,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    if (error) {
      log.error({ error, to: options.to }, "Failed to send email");
      return { success: false, error: error.message };
    }

    log.info({ id: data?.id, to: options.to }, "Email sent successfully");
    return { success: true, id: data?.id ?? "unknown" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error({ error, to: options.to }, "Failed to send email");
    return { success: false, error: message };
  }
}

/**
 * Check if email sending is configured
 * Note: RESEND_API_KEY is now required at build time, so this always returns true
 */
export function isEmailConfigured(): boolean {
  return true;
}
