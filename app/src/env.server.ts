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

  // Usage limits — when "true", per-user daily AI limits actually block (429).
  // Optional; absent/anything-else = shadow mode (count + log, don't block).
  // The boolean coercion lives in `isUsageLimitsEnforced()` (usage-limits.ts),
  // which reads process.env directly for Trigger.dev import safety; this entry
  // just validates/documents the flag at build time.
  USAGE_LIMITS_ENFORCED: z.string().optional(),

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
