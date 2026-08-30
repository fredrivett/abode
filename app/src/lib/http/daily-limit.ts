import { NextResponse } from "next/server";
import { DAILY_LIMIT_REACHED_CODE } from "@/lib/usage-limits.shared";

/**
 * Uniform 429 for a blocked-by-daily-cap action (the `guardDailyLimit` gate).
 * Carries the `daily_limit_reached` code the client keys off (`isDailyLimitError`
 * → clear "daily limit" toast) plus a seconds-to-reset `Retry-After`. Centralised
 * so every guarded route returns the same contract and none can drift or forget
 * the code. `retryAfterSeconds` is `guard.check.retryAfterSeconds`.
 */
export function dailyLimitResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { message: "Daily limit reached", code: DAILY_LIMIT_REACHED_CODE },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}
