/**
 * Emoji validation utilities.
 */

// Base emoji: either Emoji_Presentation (always emoji) or Extended_Pictographic (covers ❤, etc.)
const BASE_EMOJI = "(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic})";
// Emoji with optional variation selector and optional skin tone modifier
const EMOJI_WITH_MODIFIERS = `${BASE_EMOJI}\\uFE0F?(?:\\p{Emoji_Modifier})?`;
// ZWJ sequence: emojis joined by zero-width joiner
const ZWJ_SEQUENCE = `(?:\\u200D${EMOJI_WITH_MODIFIERS})*`;
// Flag: two regional indicator symbols
const FLAG = "\\p{Regional_Indicator}{2}";

/**
 * Comprehensive emoji regex that matches:
 * - Simple emojis (😀, 🎉, 🚀)
 * - Text-style emojis with/without variation selector (❤, ❤️)
 * - Flag emojis (Regional Indicator pairs like 🇺🇸)
 * - Skin tone modifiers (👋🏻)
 * - ZWJ sequences (👨‍👩‍👧, 👩‍💻)
 */
const EMOJI_REGEX = new RegExp(
  `^(?:${FLAG}|${EMOJI_WITH_MODIFIERS}${ZWJ_SEQUENCE})$`,
  "u",
);

/**
 * Check if a string is a valid single emoji.
 * Handles simple emojis, compound emojis (flags, skin tones), and ZWJ sequences.
 */
export function isValidEmoji(str: string): boolean {
  return EMOJI_REGEX.test(str);
}
