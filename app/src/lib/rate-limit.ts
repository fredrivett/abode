/**
 * In-memory rate limiter using sliding window algorithm.
 *
 * Rate limits:
 * - Search: 30 req/min (expensive - embedding API calls)
 * - Filters: 120 req/min (cheap - DB reads only)
 *
 * Returns 429 Too Many Requests with Retry-After header when exceeded.
 */

// Sliding window entry: timestamp of request
type RateLimitEntry = {
  timestamps: number[];
};

// In-memory store keyed by userId:endpoint
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries periodically (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

/**
 * Rate limit configuration by endpoint type.
 */
export const RATE_LIMITS = {
  search: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
  },
  filters: {
    maxRequests: 120,
    windowMs: 60 * 1000, // 1 minute
  },
  usernameCheck: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
  },
  waitlist: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute - prevents signup spam
  },
  embed: {
    maxRequests: 60,
    windowMs: 60 * 1000, // 1 minute - public widget API
  },
} as const;

export type RateLimitEndpoint = keyof typeof RATE_LIMITS;

/**
 * Result of rate limit check.
 */
export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix timestamp in seconds
  retryAfter?: number; // Seconds until limit resets (only if not allowed)
};

/**
 * Clean up old entries from the store.
 */
function cleanupStore() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;

  lastCleanup = now;
  const maxWindowMs = Math.max(
    RATE_LIMITS.search.windowMs,
    RATE_LIMITS.filters.windowMs,
  );

  for (const [key, entry] of rateLimitStore) {
    // Remove timestamps older than the max window
    entry.timestamps = entry.timestamps.filter(
      (ts) => now - ts < maxWindowMs * 2,
    );

    // Remove empty entries
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Check if a request is allowed under the rate limit.
 *
 * @param userId - User ID to rate limit
 * @param endpoint - Endpoint type (search or filters)
 * @returns Rate limit result
 */
export function checkRateLimit(
  userId: string,
  endpoint: RateLimitEndpoint,
): RateLimitResult {
  cleanupStore();

  const config = RATE_LIMITS[endpoint];
  const key = `${userId}:${endpoint}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Get or create entry
  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

  // Calculate remaining requests
  const requestCount = entry.timestamps.length;
  const remaining = Math.max(0, config.maxRequests - requestCount);

  // Calculate reset time (when oldest request in window expires)
  const oldestTimestamp = entry.timestamps[0] || now;
  const resetAt = Math.ceil((oldestTimestamp + config.windowMs) / 1000);

  // Check if allowed
  if (requestCount >= config.maxRequests) {
    const retryAfter = Math.ceil(
      (oldestTimestamp + config.windowMs - now) / 1000,
    );
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter: Math.max(1, retryAfter),
    };
  }

  // Record this request
  entry.timestamps.push(now);

  return {
    allowed: true,
    remaining: remaining - 1, // Subtract 1 for this request
    resetAt,
  };
}

/**
 * Get rate limit headers for response.
 */
export function getRateLimitHeaders(
  result: RateLimitResult,
  endpoint: RateLimitEndpoint,
): Record<string, string> {
  const config = RATE_LIMITS[endpoint];

  return {
    "X-RateLimit-Limit": config.maxRequests.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.resetAt.toString(),
    ...(result.retryAfter && { "Retry-After": result.retryAfter.toString() }),
  };
}

/**
 * Clear rate limit data for a user (for testing).
 */
export function clearRateLimit(userId: string, endpoint?: RateLimitEndpoint) {
  if (endpoint) {
    rateLimitStore.delete(`${userId}:${endpoint}`);
  } else {
    for (const key of rateLimitStore.keys()) {
      if (key.startsWith(`${userId}:`)) {
        rateLimitStore.delete(key);
      }
    }
  }
}

/**
 * Clear all rate limit data (for testing).
 */
export function clearAllRateLimits() {
  rateLimitStore.clear();
}

/**
 * Extract client IP from request headers.
 * Handles x-forwarded-for (proxy chains) and x-real-ip.
 * Used for rate limiting logged-out users (e.g., username availability check).
 */
export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    // Take the first IP in the chain (original client)
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return headers.get("x-real-ip") || "unknown";
}
