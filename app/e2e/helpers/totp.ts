import { createHmac } from "node:crypto";

/** RFC 4648 base32 decode (no padding, A-Z2-7) → bytes. */
function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/**
 * Generate a 6-digit TOTP code (RFC 6238, SHA1, 30s step) for a base32 secret.
 *
 * Lets e2e tests drive the Supabase MFA flow without a third-party OTP library.
 */
export function generateTotp(
  secret: string,
  atMs: number = Date.now(),
): string {
  const key = base32Decode(secret);
  const counter = Math.floor(atMs / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);

  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binary % 1_000_000).toString().padStart(6, "0");
}

const TOTP_PERIOD_MS = 30 * 1000;

/**
 * Minimum time that must remain in the current window before we hand a code to
 * the challenge, so it can't roll over between generation, entry, and verify.
 */
const MIN_TOTP_RUNWAY_MS = 6 * 1000;

/** The 30s TOTP window (counter) index containing `atMs`. */
export function totpWindow(atMs: number = Date.now()): number {
  return Math.floor(atMs / 1000 / 30);
}

/** ms remaining in the TOTP window that contains `atMs`. */
function runwayRemainingMs(atMs: number): number {
  return (totpWindow(atMs) + 1) * TOTP_PERIOD_MS - atMs;
}

/**
 * Resolve once the current 30s TOTP window is safe to generate a login code in,
 * meaning it is BOTH:
 *   (a) strictly later than the window holding `afterMs`, and
 *   (b) has at least `MIN_TOTP_RUNWAY_MS` left.
 *
 * (a) avoids a replay: Supabase rejects a code whose period was already
 * consumed, so the login challenge must not reuse the enrollment window burned
 * during MFA setup. (b) avoids a rollover: without it the "common case" (window
 * already advanced) could hand back a code with only a few ms of life, which
 * then expires between entry and verify and is rejected — stalling the test on
 * the challenge. Loops rather than computing a single sleep so both conditions
 * are re-checked after waking (converges in at most two windows).
 */
export async function waitForTotpWindowAfter(afterMs: number): Promise<void> {
  const enrollmentWindow = totpWindow(afterMs);
  for (;;) {
    const now = Date.now();
    if (
      totpWindow(now) > enrollmentWindow &&
      runwayRemainingMs(now) >= MIN_TOTP_RUNWAY_MS
    ) {
      return;
    }
    // Sleep just past the next window boundary, then re-check both conditions.
    const nextWindowStartMs = (totpWindow(now) + 1) * TOTP_PERIOD_MS;
    await new Promise((resolve) =>
      setTimeout(resolve, nextWindowStartMs - now + 10),
    );
  }
}
