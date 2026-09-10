import { describe, expect, it } from "vitest";
import { envSchema } from "@/env.server";

/**
 * Required-core env keys — the only tier allowed to be non-optional. Everything
 * else in the schema is an optional-service enhancement and MUST be `.optional()`
 * so a minimal deploy (these keys + nothing else) still boots. This encodes rule
 * 5 of the Optional Services & Graceful Degradation contract (CLAUDE.md / AGENTS.md).
 *
 * Adding a key here is a deliberate decision to make it required-to-boot. Don't
 * add one just to silence this test — a new integration's key belongs in the
 * optional tier.
 */
const REQUIRED_CORE_KEYS = new Set([
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]);

/**
 * A field is "required" if it rejects an unset (`undefined`) value. This probes
 * behaviour rather than zod internals, so it holds regardless of how optionality
 * is expressed (`.optional()`, `.preprocess(... .optional())`, etc.).
 */
function rejectsUnset(field: {
  safeParse: (v: unknown) => { success: boolean };
}) {
  return !field.safeParse(undefined).success;
}

describe("env.server schema — optional-services contract", () => {
  const entries = Object.entries(envSchema.shape);

  for (const [key, field] of entries) {
    if (REQUIRED_CORE_KEYS.has(key)) {
      it(`${key} is required-core (rejects an unset value)`, () => {
        expect(rejectsUnset(field)).toBe(true);
      });
    } else {
      it(`${key} is optional-service tier (tolerates an unset value)`, () => {
        expect(rejectsUnset(field)).toBe(false);
      });
    }
  }

  it("has no required key outside the declared core tier", () => {
    const requiredInSchema = entries
      .filter(([, field]) => rejectsUnset(field))
      .map(([key]) => key)
      .sort();

    // A failure here means a new `.min(1)` (non-optional) key was added. If it's
    // genuinely required-to-boot, add it to REQUIRED_CORE_KEYS above; otherwise
    // make it `.optional()` so a minimal self-host deploy still boots.
    expect(requiredInSchema).toEqual([...REQUIRED_CORE_KEYS].sort());
  });
});
