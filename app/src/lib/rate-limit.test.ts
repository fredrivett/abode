import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkRateLimit,
  clearAllRateLimits,
  getClientIp,
  getRateLimitHeaders,
  RATE_LIMITS,
} from "./rate-limit";

// A fixed base time so window math is exact and deterministic.
const BASE = 1_700_000_000_000; // ms

describe("checkRateLimit", () => {
  beforeEach(() => {
    clearAllRateLimits();
    vi.useFakeTimers();
    vi.setSystemTime(BASE);
  });

  afterEach(() => {
    vi.useRealTimers();
    clearAllRateLimits();
  });

  it("allows exactly maxRequests then denies the next (boundary)", () => {
    const { maxRequests } = RATE_LIMITS.search;

    // The first `maxRequests` requests are allowed.
    for (let i = 0; i < maxRequests; i++) {
      const result = checkRateLimit("user-1", "search");
      expect(result.allowed).toBe(true);
    }

    // The (maxRequests + 1)-th request in the same window is denied.
    const denied = checkRateLimit("user-1", "search");
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfter).toBeDefined();
  });

  it("counts down `remaining` correctly across the window", () => {
    const { maxRequests } = RATE_LIMITS.search;

    // Request k (1-indexed) reports maxRequests - k remaining.
    for (let k = 1; k <= maxRequests; k++) {
      const result = checkRateLimit("user-remaining", "search");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(maxRequests - k);
    }

    // Last allowed request left 0 remaining; next is denied with 0 remaining.
    const denied = checkRateLimit("user-remaining", "search");
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
  });

  it("evicts timestamps once the window passes (sliding window)", () => {
    const { maxRequests, windowMs } = RATE_LIMITS.search;

    // Exhaust the limit at BASE.
    for (let i = 0; i < maxRequests; i++) {
      expect(checkRateLimit("user-slide", "search").allowed).toBe(true);
    }
    expect(checkRateLimit("user-slide", "search").allowed).toBe(false);

    // Advance past the window; the old timestamps (ts > now - windowMs is now
    // false for all of them) drop out, so a fresh request is allowed again.
    vi.setSystemTime(BASE + windowMs + 1);
    const afterWindow = checkRateLimit("user-slide", "search");
    expect(afterWindow.allowed).toBe(true);
    expect(afterWindow.remaining).toBe(maxRequests - 1);
  });

  it("keeps timestamps that are still inside the window", () => {
    const { maxRequests, windowMs } = RATE_LIMITS.search;

    // Fill the window at BASE.
    for (let i = 0; i < maxRequests; i++) {
      checkRateLimit("user-partial", "search");
    }

    // Still strictly inside the window (windowStart = now - windowMs is strict
    // `ts > windowStart`), so nothing has been evicted yet -> still denied.
    vi.setSystemTime(BASE + windowMs - 1);
    expect(checkRateLimit("user-partial", "search").allowed).toBe(false);
  });

  it("computes retryAfter as whole seconds, floored to at least 1", () => {
    const { maxRequests, windowMs } = RATE_LIMITS.search;

    for (let i = 0; i < maxRequests; i++) {
      checkRateLimit("user-retry", "search");
    }

    // Immediately after exhausting, retryAfter ~= full window in seconds.
    const denied = checkRateLimit("user-retry", "search");
    expect(denied.retryAfter).toBe(Math.ceil(windowMs / 1000));

    // Near the very end of the window, retryAfter is clamped to a minimum of 1
    // (Math.max(1, ...)) rather than 0.
    vi.setSystemTime(BASE + windowMs - 1);
    const nearEnd = checkRateLimit("user-retry", "search");
    expect(nearEnd.allowed).toBe(false);
    expect(nearEnd.retryAfter).toBe(1);
  });

  it("isolates limits per user and per endpoint (keyed by userId:endpoint)", () => {
    const { maxRequests } = RATE_LIMITS.search;

    for (let i = 0; i < maxRequests; i++) {
      checkRateLimit("user-a", "search");
    }
    // user-a is exhausted on search...
    expect(checkRateLimit("user-a", "search").allowed).toBe(false);
    // ...but a different user is unaffected...
    expect(checkRateLimit("user-b", "search").allowed).toBe(true);
    // ...and the same user on a different endpoint is unaffected.
    expect(checkRateLimit("user-a", "filters").allowed).toBe(true);
  });
});

describe("RATE_LIMITS named buckets", () => {
  beforeEach(() => {
    clearAllRateLimits();
    vi.useFakeTimers();
    vi.setSystemTime(BASE);
  });

  afterEach(() => {
    vi.useRealTimers();
    clearAllRateLimits();
  });

  it("applies the configured limit for each bucket", () => {
    const buckets = Object.keys(RATE_LIMITS) as (keyof typeof RATE_LIMITS)[];

    for (const bucket of buckets) {
      const { maxRequests } = RATE_LIMITS[bucket];
      const user = `bucket-${bucket}`;

      for (let i = 0; i < maxRequests; i++) {
        expect(checkRateLimit(user, bucket).allowed).toBe(true);
      }
      expect(checkRateLimit(user, bucket).allowed).toBe(false);
    }
  });

  it("uses a 24h window for emojiSuggestDaily", () => {
    const { maxRequests, windowMs } = RATE_LIMITS.emojiSuggestDaily;
    expect(windowMs).toBe(24 * 60 * 60 * 1000);

    for (let i = 0; i < maxRequests; i++) {
      checkRateLimit("daily-user", "emojiSuggestDaily");
    }
    expect(checkRateLimit("daily-user", "emojiSuggestDaily").allowed).toBe(
      false,
    );

    // Just before 24h: still capped.
    vi.setSystemTime(BASE + windowMs - 1);
    expect(checkRateLimit("daily-user", "emojiSuggestDaily").allowed).toBe(
      false,
    );

    // After 24h: the window resets.
    vi.setSystemTime(BASE + windowMs + 1);
    expect(checkRateLimit("daily-user", "emojiSuggestDaily").allowed).toBe(
      true,
    );
  });

  it("uses the documented generous limit and 1m window for twitterVideo", () => {
    expect(RATE_LIMITS.twitterVideo.maxRequests).toBe(200);
    expect(RATE_LIMITS.twitterVideo.windowMs).toBe(60 * 1000);
  });

  it("uses 30 req/min for search", () => {
    expect(RATE_LIMITS.search.maxRequests).toBe(30);
    expect(RATE_LIMITS.search.windowMs).toBe(60 * 1000);
  });
});

describe("getRateLimitHeaders", () => {
  it("omits Retry-After when the request is allowed", () => {
    const headers = getRateLimitHeaders(
      { allowed: true, remaining: 29, resetAt: 1700 },
      "search",
    );
    expect(headers["X-RateLimit-Limit"]).toBe("30");
    expect(headers["X-RateLimit-Remaining"]).toBe("29");
    expect(headers["X-RateLimit-Reset"]).toBe("1700");
    expect(headers["Retry-After"]).toBeUndefined();
  });

  it("includes Retry-After when the request is denied", () => {
    const headers = getRateLimitHeaders(
      { allowed: false, remaining: 0, resetAt: 1700, retryAfter: 42 },
      "search",
    );
    expect(headers["Retry-After"]).toBe("42");
  });
});

describe("getClientIp", () => {
  it("takes the first (trimmed) IP from x-forwarded-for", () => {
    const headers = new Headers({
      "x-forwarded-for": "  203.0.113.9 , 70.41.3.18 , 150.172.238.178",
    });
    expect(getClientIp(headers)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.7" });
    expect(getClientIp(headers)).toBe("198.51.100.7");
  });

  it("prefers x-forwarded-for over x-real-ip when both are present", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.9",
      "x-real-ip": "198.51.100.7",
    });
    expect(getClientIp(headers)).toBe("203.0.113.9");
  });

  it("returns 'unknown' when neither header is present", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });

  it("returns 'unknown' when x-forwarded-for is empty/whitespace", () => {
    const headers = new Headers({ "x-forwarded-for": "   " });
    expect(getClientIp(headers)).toBe("unknown");
  });
});
