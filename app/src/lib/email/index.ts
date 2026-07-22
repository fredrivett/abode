import nodemailer from "nodemailer";
import { Resend } from "resend";
import { isDevelopment } from "@/env";
import { env } from "@/env.server";
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

// Lazy initialization of local SMTP transport (Inbucket)
// Port must match smtp_port in supabase/config.toml
let localTransport: nodemailer.Transporter | null = null;

function getLocalTransport(): nodemailer.Transporter {
  if (!localTransport) {
    localTransport = nodemailer.createTransport({
      host: "localhost",
      port: Number.parseInt(process.env.LOCAL_SMTP_PORT || "54325", 10),
      secure: false,
    });
  }
  return localTransport;
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
 * Send an email via SMTP to local Inbucket instance
 */
async function sendEmailLocal(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendEmailResult> {
  try {
    const transport = getLocalTransport();

    const info = await transport.sendMail({
      from: EMAIL_CONFIG.from,
      replyTo: EMAIL_CONFIG.replyTo,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    log.info(
      { id: info.messageId, to: options.to },
      "Email sent to Inbucket (local dev)",
    );
    return { success: true, id: info.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error({ error, to: options.to }, "Failed to send email to Inbucket");
    return { success: false, error: message };
  }
}

/**
 * Send an email via Resend (production)
 */
async function sendEmailResend(options: {
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
 * Send an email
 * - In local development: routes to Inbucket via SMTP
 * - In production: uses Resend API
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

  // Local development: send to Inbucket via SMTP
  if (isDevelopment) {
    return sendEmailLocal(options);
  }

  // Production: use Resend if configured, otherwise skip gracefully
  if (!isEmailConfigured()) {
    log.warn({ to: options.to }, "Email skipped (Resend not configured)");
    return { success: false, error: "Email not configured" };
  }
  return sendEmailResend(options);
}

/**
 * Pure predicate for whether email is configured, given the environment.
 * Extracted from isEmailConfigured for testability.
 */
export function resolveEmailConfigured(params: {
  isDevelopment: boolean;
  hasResendKey: boolean;
}): boolean {
  // Dev routes to local Inbucket and needs no key; elsewhere a Resend key is required
  return params.isDevelopment || params.hasResendKey;
}

/**
 * Whether email sending is configured.
 *
 * Optional enhancement (graceful degradation — see AGENTS.md). Callers should
 * gate email paths on this and skip cleanly when it returns false rather than
 * failing the surrounding request.
 */
export function isEmailConfigured(): boolean {
  return resolveEmailConfigured({
    isDevelopment,
    hasResendKey: Boolean(env.RESEND_API_KEY),
  });
}
