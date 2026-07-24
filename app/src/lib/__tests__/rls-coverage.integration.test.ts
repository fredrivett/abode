/// <reference types="vitest/globals" />

/**
 * Guardrail: every application table must have row level security enabled
 * (default-deny), matching the hardening in the enable_rls migrations. The app
 * reaches its tables only via Prisma as the table owner (which bypasses RLS),
 * so a table that ships without RLS is a silent hole — reachable by the
 * anon/authenticated PostgREST roles and flagged by Supabase advisors.
 *
 * This runs against the fully-migrated test database, so any new table that
 * forgets to enable RLS fails here instead of reaching production.
 */

// Infrastructure tables that aren't app data and don't need RLS.
const NON_APP_TABLES = new Set<string>([
  "_prisma_migrations", // Prisma's own migration ledger
]);

// Tables whose RLS + auth.uid() policies are created inside `IF EXISTS (auth
// schema)` guards (migrations 20251208211300, 20251210003700). RLS IS enabled
// in production (Supabase has the `auth` schema), but the guarded block no-ops
// on this test DB (no `auth` schema), so this enable-only test can't observe
// it. Their policy shape belongs in an E2E check against real Supabase.
const AUTH_GUARDED_RLS_TABLES = new Set<string>([
  "items",
  "item_visual_vectors",
  "item_text_vectors",
]);

// A new app table should get RLS in its migration, not an entry here.
const RLS_EXEMPT_TABLES = new Set<string>([
  ...NON_APP_TABLES,
  ...AUTH_GUARDED_RLS_TABLES,
]);

describe("row level security coverage", () => {
  it("every application table in public has RLS enabled", async () => {
    const { read } = await import("@/lib/db");

    const tables = await read.$queryRaw<
      { tablename: string; rowsecurity: boolean }[]
    >`
      SELECT c.relname AS tablename, c.relrowsecurity AS rowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    `;

    // Sanity check: we actually queried a populated schema
    expect(tables.length).toBeGreaterThan(0);

    const withoutRls = tables
      .filter((t) => !RLS_EXEMPT_TABLES.has(t.tablename) && !t.rowsecurity)
      .map((t) => t.tablename);

    expect(
      withoutRls,
      `Tables missing row level security: ${withoutRls.join(", ")}. ` +
        'Enable it in a migration (ALTER TABLE "<table>" ENABLE ROW LEVEL ' +
        "SECURITY;), or add a justified exemption to RLS_EXEMPT_TABLES.",
    ).toEqual([]);
  });
});
