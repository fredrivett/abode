/**
 * Server-only environment variable validation with zod
 * This file is imported during the build process to ensure required env vars are set
 * TypeScript automatically infers the correct types from the zod schema
 */

import "server-only";

import { z } from "zod";

// Server environment validation schema
// Includes both server-only secrets and public vars (to ensure they're set at build time)
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1),
  READ_REPLICA_DATABASE_URL: z.string().optional(),

  // Supabase (public vars validated here to ensure they're set)
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .min(1)
    .refine((val) => val.startsWith("http://") || val.startsWith("https://"), {
      message: "Must be a valid URL",
    }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1), // server-only secret

  // Email (server-only) — optional enhancement; when absent, email features
  // (invites, waitlist, admin notifications) degrade gracefully. See AGENTS.md.
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  RESEND_REPLY_TO_EMAIL: z.string().optional(),

  // AI (server-only)
  OPENAI_API_KEY: z.string().optional(),

  // PostHog (optional analytics)
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().min(1).optional(),

  // Usage limits enforcement. Secure-by-default: "true" always enforces (429s),
  // "false" always opts out; when UNSET, enforcement is on for any built/deployed
  // env (NODE_ENV=production — prod, preview, staging) and off for local dev +
  // tests. So a deployed instance is capped without configuration; set "false" to
  // deliberately run a shadow window. The logic lives in `isUsageLimitsEnforced()`
  // (usage-limits.ts), which reads process.env directly for Trigger.dev import
  // safety; this entry just validates/documents the flag at build time.
  USAGE_LIMITS_ENFORCED: z.string().optional(),

  // Dollar-denominated daily backstops. Both optional and env-overridable so prod
  // can raise a cap without a deploy; absent/blank/≤0 falls back to the compiled
  // default (see `perUserDailyUsdLimit()` / `systemDailyUsdLimit()` in
  // usage-limits.ts, which read process.env directly for Trigger.dev import safety).
  // PER_USER_DAILY_USD: per-account daily $ cap (spike limiter).
  // PER_USER_MONTHLY_USD: per-account monthly $ cap (binding economic ceiling).
  // SYSTEM_DAILY_USD: global circuit-breaker across all users. Kept as strings
  // (validated as positive numbers at use), matching the USAGE_LIMITS_ENFORCED
  // handling above.
  PER_USER_DAILY_USD: z.string().optional(),
  PER_USER_MONTHLY_USD: z.string().optional(),
  SYSTEM_DAILY_USD: z.string().optional(),

  // Base URL of this env's Trigger.dev runs dashboard (Project > Runs), used to
  // build "Monitor" links from the admin reprocess UI. Optional — absent = no
  // link. Kept out of the codebase (contains the private org/project/env slugs);
  // set it per-environment. A blank value (e.g. the copied `.env.example` line)
  // normalises to `undefined` so it degrades to "no link" instead of failing
  // URL validation and throwing at boot.
  TRIGGER_RUNS_DASHBOARD_URL: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().url().optional(),
  ),

  // Trigger.dev secret API key. The SDK reads it from process.env directly for
  // triggering; we validate it here (optional) only so the admin runs-list can
  // gate the Management API call on its presence — absent = show no runs list.
  TRIGGER_SECRET_KEY: z.string().optional(),

  // Node environment
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
});

// Skip validation during unit tests - they don't need real env vars
// Integration tests that need the database should set these vars
const isUnitTest = process.env.VITEST === "true" && !process.env.DATABASE_URL;

// Validate and parse environment variables
// This will throw a detailed error if validation fails
const parsed = isUnitTest
  ? { success: true as const, data: process.env as z.infer<typeof envSchema> }
  : envSchema.safeParse(process.env);

if (!parsed.success) {
  // biome-ignore lint/suspicious/noConsole: needed for build-time error reporting
  console.error("❌ Invalid environment variables:");
  // biome-ignore lint/suspicious/noConsole: needed for build-time error reporting
  console.error(JSON.stringify(z.flattenError(parsed.error), null, 2));
  throw new Error("Invalid environment variables");
}

// Export validated and typed environment variables
// TypeScript now knows the exact types without any assertions!
export const env = parsed.data;
