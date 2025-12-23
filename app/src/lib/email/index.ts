import { Resend } from "resend";
import { createLogger } from "@/lib/logger.server";

const log = createLogger("lib/email");

// Lazy initialization of Resend client
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/**
 * Email configuration
 */
const EMAIL_CONFIG = {
  from: process.env.RESEND_FROM_EMAIL || "fred <fred@abode.fyi>",
  replyTo: process.env.RESEND_REPLY_TO_EMAIL,
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
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}
