import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { envSchema } from "@/env.server";

/**
 * Keeps the env schema (env.server.ts) and the root `.env.example` in sync, so a
 * key can't be added to one and silently forgotten in the other (as happened
 * with JEV_*). Mirrors the `check:commands-doc` guard: adding a key forces a
 * deliberate "document it in .env.example, or allowlist it here".
 */

// Schema keys intentionally NOT in .env.example: internal runtime/tuning flags
// and analytics that default off. A credential or URL for an external service
// does NOT belong here — document it in .env.example instead.
const SCHEMA_KEYS_NOT_IN_EXAMPLE = new Set([
  "NODE_ENV",
  "USAGE_LIMITS_ENFORCED",
  "PER_USER_DAILY_USD",
  "PER_USER_MONTHLY_USD",
  "SYSTEM_DAILY_USD",
  "BACKGROUND_RESERVE_FRACTION",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_POSTHOG_HOST",
  "RESEND_REPLY_TO_EMAIL",
]);

// .env.example keys NOT validated by envSchema: read directly via process.env
// elsewhere (e.g. isReplicateConfigured) or consumed outside the Next app
// (Prisma, seed script, Supabase MCP tooling).
const EXAMPLE_KEYS_NOT_IN_SCHEMA = new Set([
  "DIRECT_URL",
  "PRISMA_LOG_QUERIES",
  "SUPABASE_PROJECT_REF",
  "GOOGLE_CLOUD_PROJECT_ID",
  "GOOGLE_CLOUD_CREDENTIALS",
  "REPLICATE_API_TOKEN",
  "MAPBOX_ACCESS_TOKEN",
  "SEED_USER_PASSWORD",
]);

// app/src → repo root (../..), matching the layout used by check-commands-doc.ts.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const exampleKeys = new Set(
  readFileSync(join(repoRoot, ".env.example"), "utf8")
    .split("\n")
    .map((line) => line.match(/^([A-Z0-9_]+)=/)?.[1])
    .filter((key): key is string => Boolean(key)),
);
const schemaKeys = Object.keys(envSchema.shape);

describe("env schema ⇄ .env.example are in sync", () => {
  for (const key of schemaKeys) {
    if (SCHEMA_KEYS_NOT_IN_EXAMPLE.has(key)) continue;
    it(`${key} is documented in .env.example`, () => {
      // A failure means a schema key isn't in .env.example. Add it there (the
      // usual fix for an external-service key), or, if it's an internal
      // runtime/tuning flag, add it to SCHEMA_KEYS_NOT_IN_EXAMPLE above.
      expect(exampleKeys.has(key)).toBe(true);
    });
  }

  it("every .env.example key is validated by the schema (or allowlisted)", () => {
    const unvalidated = [...exampleKeys].filter(
      (key) =>
        !schemaKeys.includes(key) && !EXAMPLE_KEYS_NOT_IN_SCHEMA.has(key),
    );
    // A failure means a .env.example key isn't in envSchema — likely a typo or
    // rename, or a key read via process.env directly (add it to
    // EXAMPLE_KEYS_NOT_IN_SCHEMA).
    expect(unvalidated).toEqual([]);
  });

  it("has no stale allowlist entries", () => {
    for (const key of SCHEMA_KEYS_NOT_IN_EXAMPLE) {
      expect(
        schemaKeys,
        `stale SCHEMA_KEYS_NOT_IN_EXAMPLE entry: ${key}`,
      ).toContain(key);
    }
    for (const key of EXAMPLE_KEYS_NOT_IN_SCHEMA) {
      expect(
        [...exampleKeys],
        `stale EXAMPLE_KEYS_NOT_IN_SCHEMA entry: ${key}`,
      ).toContain(key);
    }
  });
});
