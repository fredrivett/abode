/**
 * Server-only environment variable validation with zod
 * This file is imported during the build process to ensure required env vars are set
 * TypeScript automatically infers the correct types from the zod schema
 */

import "server-only";

import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1),
  READ_REPLICA_DATABASE_URL: z.string().optional(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .min(1)
    .refine((val) => val.startsWith("http://") || val.startsWith("https://"), {
      message: "Must be a valid URL",
    }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Email
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().optional(),
  RESEND_REPLY_TO_EMAIL: z.string().optional(),

  // AI
  OPENAI_API_KEY: z.string().optional(),

  // Maps
  GOOGLE_MAPS_API_KEY: z.string().optional(),

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
