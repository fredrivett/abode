/**
 * Username validation and utilities.
 */

export {
  containsOffensiveContent,
  isReservedWord,
  RESERVED_WORDS,
} from "./reserved-words";
export {
  type UsernameStatus,
  useUsernameAvailability,
} from "./use-username-availability";
export {
  MAX_USERNAME_CHANGES,
  MIN_LETTERS_REQUIRED,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
  type UsernameValidationResult,
  validateUsernameFormat,
} from "./validation";

/**
 * Type for tracking previous usernames when a user changes their username.
 */
export type PreviousUsername = {
  username: string;
  changedAt: string;
};

import { containsOffensiveContent, isReservedWord } from "./reserved-words";
import {
  type UsernameValidationResult,
  validateUsernameFormat,
} from "./validation";

/**
 * Full username validation including format, reserved words, and offensive content.
 * Does NOT check database availability.
 */
export function validateUsername(username: string): UsernameValidationResult {
  // Format validation
  const formatResult = validateUsernameFormat(username);
  if (!formatResult.valid) {
    return formatResult;
  }

  // Reserved word check
  if (isReservedWord(username)) {
    return { valid: false, error: "This username is not available" };
  }

  // Offensive content check
  if (containsOffensiveContent(username)) {
    return {
      valid: false,
      error: "This username contains inappropriate content",
    };
  }

  return { valid: true };
}
