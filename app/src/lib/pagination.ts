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

/** Canonical UUID format, matching Postgres `@db.Uuid` columns. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True when `value` is a canonical UUID string. Cursor ids are compared
 * against uuid columns, so a non-UUID would reach Postgres as
 * `invalid input syntax for type uuid` and 500.
 */
export function isCanonicalUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function isValidCursorData(value: unknown): value is CursorData {
  if (typeof value !== "object" || value === null) return false;
  const { createdAt, id } = value as Record<string, unknown>;
  if (typeof createdAt !== "string" || typeof id !== "string") return false;
  if (!isCanonicalUuid(id)) return false;
  return !Number.isNaN(new Date(createdAt).getTime());
}

/**
 * Decodes a base64url cursor string back to cursor data.
 * Returns null for any malformed input — bad base64, non-JSON, wrong shape,
 * or an unparseable `createdAt` — so a crafted cursor can't reach the DB layer.
 */
export function decodeCursor(cursor: string): CursorData | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  return isValidCursorData(parsed) ? parsed : null;
}

/**
 * Default page size for item listings.
 */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Maximum allowed page size.
 */
export const MAX_PAGE_SIZE = 100;

/**
 * Parses a client-supplied `limit` param into a safe page size.
 * Falls back to DEFAULT_PAGE_SIZE on missing/non-numeric input and clamps
 * the result to [1, MAX_PAGE_SIZE] — never returns NaN.
 */
export function parsePageSize(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(parsed)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(1, parsed), MAX_PAGE_SIZE);
}
