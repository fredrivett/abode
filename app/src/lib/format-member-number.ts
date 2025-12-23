/**
 * Formats a member number with 5 zero-padding
 * @param memberNumber - The member number to format
 * @returns Formatted member number (e.g., "00001", "00123", "12345")
 */
export function formatMemberNumber(
  memberNumber: number | null | undefined,
): string | null {
  if (memberNumber == null) {
    return null;
  }

  return memberNumber.toString().padStart(5, "0");
}
