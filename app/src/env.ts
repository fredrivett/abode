/**
 * Client-safe environment variable validation with zod
 * These can be imported from both server and client components
 *
 * Note: Only NEXT_PUBLIC_* vars are available on the client.
 * Uses graceful fallbacks since we don't want to crash the user's browser.
 */

import { z } from "zod";

export const clientEnvSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .min(1)
    .refine((val) => val.startsWith("http://") || val.startsWith("https://"), {
      message: "Must be a valid URL",
    })
    .optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),

  // PostHog
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().min(1).optional(),
});

const parsed = clientEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
});

// Export individual vars with fallbacks for client usage
export const SUPABASE_URL = parsed.data?.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = parsed.data?.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const POSTHOG_KEY = parsed.data?.NEXT_PUBLIC_POSTHOG_KEY ?? "";
export const POSTHOG_HOST = parsed.data?.NEXT_PUBLIC_POSTHOG_HOST;

export const isDevelopment = process.env.NODE_ENV === "development";
