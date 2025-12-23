import disposableDomains from "disposable-email-domains";

const disposableDomainsSet = new Set(disposableDomains);

export type EmailValidationResult = {
  valid: boolean;
  error?: string;
};

/**
 * Basic email format validation
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if email domain is a known disposable email provider
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return disposableDomainsSet.has(domain);
}

/**
 * Validate email for invite/waitlist purposes
 * - Checks format
 * - Blocks disposable email domains
 */
export function validateEmail(email: string): EmailValidationResult {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return { valid: false, error: "Email is required" };
  }

  if (!isValidEmail(normalizedEmail)) {
    return { valid: false, error: "Invalid email format" };
  }

  if (isDisposableEmail(normalizedEmail)) {
    return {
      valid: false,
      error: "Disposable email addresses are not allowed",
    };
  }

  return { valid: true };
}

/**
 * Normalize email for storage (lowercase, trimmed)
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
