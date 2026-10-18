import "server-only";
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import type { ItemPrivacy } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isSensitive, SENSITIVE_LOCKED_CODE } from "./privacy";

/**
 * Sensitive-item unlock: after the owner re-enters their password, a short-lived
 * signed cookie lets the item endpoints serve sensitive content. Each sensitive
 * request made while it's valid restarts the window, so it lapses
 * {@link SENSITIVE_UNLOCK_WINDOW_SECONDS} after the owner stops viewing them.
 *
 * The cookie is bound to the user and its expiry, and signed with a key derived
 * from the service-role secret, so it can't be forged or carried to another
 * account. It guards against someone glancing at or borrowing the screen —
 * not against a compromised session, which can already read everything.
 */

export const SENSITIVE_UNLOCK_COOKIE = "abode-sensitive-unlock";
export const SENSITIVE_UNLOCK_WINDOW_SECONDS = 120;

const KEY_INFO = "abode:sensitive-unlock:v1";

function signingKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "", KEY_INFO, 32));
}

function sign({ payload, secret }: { payload: string; secret: string }) {
  return createHmac("sha256", signingKey(secret))
    .update(payload)
    .digest("base64url");
}

/** Mint a token unlocking `userId`'s sensitive items until `expiresAt` (ms). */
export function createUnlockToken({
  userId,
  expiresAt,
  secret,
}: {
  userId: string;
  expiresAt: number;
  secret: string;
}): string {
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${sign({ payload, secret })}`;
}

/** Whether `token` is a valid, unexpired unlock for `userId`. */
export function isValidUnlockToken({
  token,
  userId,
  now,
  secret,
}: {
  token: string | undefined;
  userId: string;
  now: number;
  secret: string;
}): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [tokenUserId, expiresAtRaw, signature] = parts;
  const expiresAt = Number(expiresAtRaw);
  if (tokenUserId !== userId || !Number.isFinite(expiresAt)) return false;
  if (expiresAt <= now) return false;

  const expected = Buffer.from(
    sign({ payload: `${tokenUserId}.${expiresAtRaw}`, secret }),
  );
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function unlockSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return secret;
}

/** Whether the request's cookie unlocks `userId`'s sensitive items right now. */
export function hasSensitiveUnlock({
  cookieValue,
  userId,
}: {
  cookieValue: string | undefined;
  userId: string;
}): boolean {
  return isValidUnlockToken({
    token: cookieValue,
    userId,
    now: Date.now(),
    secret: unlockSecret(),
  });
}

/** Start (or restart) the unlock window on `response`. */
export function setSensitiveUnlockCookie({
  response,
  userId,
}: {
  response: NextResponse;
  userId: string;
}): void {
  const token = createUnlockToken({
    userId,
    expiresAt: Date.now() + SENSITIVE_UNLOCK_WINDOW_SECONDS * 1000,
    secret: unlockSecret(),
  });
  response.cookies.set(SENSITIVE_UNLOCK_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SENSITIVE_UNLOCK_WINDOW_SECONDS,
  });
}

/** Whether the current request's cookie unlocks `userId`'s sensitive items. */
export async function isSensitiveUnlocked(userId: string): Promise<boolean> {
  const cookieStore = await cookies();
  return hasSensitiveUnlock({
    cookieValue: cookieStore.get(SENSITIVE_UNLOCK_COOKIE)?.value,
    userId,
  });
}

/** The 403 for a sensitive item requested before it's unlocked. */
export function sensitiveLockedResponse(): NextResponse {
  return NextResponse.json(
    { message: "Sensitive item is locked", code: SENSITIVE_LOCKED_CODE },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * For routes serving an item's content: the locked 403 when the item is
 * sensitive and `userId` hasn't unlocked sensitive items, otherwise null.
 */
export async function sensitiveGate({
  privacy,
  userId,
}: {
  privacy: ItemPrivacy;
  userId: string | null;
}): Promise<NextResponse | null> {
  if (!isSensitive(privacy)) return null;
  if (userId && (await isSensitiveUnlocked(userId))) return null;
  return sensitiveLockedResponse();
}
