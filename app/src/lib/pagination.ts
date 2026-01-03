/**
 * Shared pagination utilities for cursor-based pagination.
 */

/**
 * Cursor data for pagination.
 * Uses createdAt + id for stable cursor-based pagination.
 */
export type CursorData = {
  createdAt: string;
  id: string;
};

/**
 * Encodes cursor data to a base64url string for use in URLs.
 */
export function encodeCursor(data: CursorData): string {
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}

/**
 * Decodes a base64url cursor string back to cursor data.
 * Returns null if the cursor is invalid.
 */
export function decodeCursor(cursor: string): CursorData | null {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * Default page size for item listings.
 */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Maximum allowed page size.
 */
export const MAX_PAGE_SIZE = 100;
