/**
 * Username format validation rules.
 *
 * Format:
 * - 2-15 characters
 * - Letters, numbers, underscores only
 * - Must contain at least 2 letters (no pure numeric usernames)
 */

export const USERNAME_MIN_LENGTH = 2;
export const USERNAME_MAX_LENGTH = 15;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
export const MIN_LETTERS_REQUIRED = 2;
export const MAX_USERNAME_CHANGES = 3;

export type UsernameValidationResult = {
  valid: boolean;
  error?: string;
};

/**
 * Validates username format (does not check availability or reserved words).
 */
export function validateUsernameFormat(
  username: string,
): UsernameValidationResult {
  if (username.length < USERNAME_MIN_LENGTH) {
    return {
      valid: false,
      error: `Username must be at least ${USERNAME_MIN_LENGTH} characters`,
    };
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Username must be at most ${USERNAME_MAX_LENGTH} characters`,
    };
  }

  if (!USERNAME_PATTERN.test(username)) {
    return {
      valid: false,
      error: "Username can only contain letters, numbers, and underscores",
    };
  }

  const letterCount = (username.match(/[a-zA-Z]/g) || []).length;
  if (letterCount < MIN_LETTERS_REQUIRED) {
    return {
      valid: false,
      error: `Username must contain at least ${MIN_LETTERS_REQUIRED} letters`,
    };
  }

  return { valid: true };
}
