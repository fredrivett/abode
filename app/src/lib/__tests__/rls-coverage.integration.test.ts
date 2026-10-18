/// <reference types="vitest/globals" />

import { SYSTEM_ONLY_TABLES } from "./rls-tables";

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

// A new table should get RLS in its migration, not an entry here. (Every table
// — including items, the vector tables and Prisma's `_prisma_migrations`
// ledger, all previously exempt — now enables RLS, so nothing needs exempting.)
const RLS_EXEMPT_TABLES = new Set<string>();

describe("row level security coverage", () => {
  it("every table in public has RLS enabled", async () => {
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

  it("every table has policies for the restricted abode_app role", async () => {
    const { read } = await import("@/lib/db");
    const tables = await read.$queryRaw<
      { tablename: string; policies: number }[]
    >`
      SELECT c.relname AS tablename,
        (SELECT count(*)::int FROM pg_policies p
          WHERE p.schemaname = 'public' AND p.tablename = c.relname
            AND 'abode_app' = ANY (p.roles)) AS policies
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    `;
    const withoutPolicies = tables
      .filter((t) => !SYSTEM_ONLY_TABLES.has(t.tablename) && t.policies === 0)
      .map((t) => t.tablename);

    expect(
      withoutPolicies,
      `Tables abode_app can't reach: ${withoutPolicies.join(", ")}. Add owner ` +
        "policies `TO abode_app` in the table's migration (see " +
        "20261018170000_abode_app_rls), or list it in ./rls-tables.ts.",
    ).toEqual([]);
  });

  it("abode_app can't bypass RLS and isn't reachable from PostgREST", async () => {
    const { read } = await import("@/lib/db");
    const [role] = await read.$queryRaw<
      { bypass: boolean; superuser: boolean; login: boolean }[]
    >`SELECT rolbypassrls AS bypass, rolsuper AS superuser, rolcanlogin AS login
      FROM pg_roles WHERE rolname = 'abode_app'`;
    expect(role).toEqual({ bypass: false, superuser: false, login: false });

    // Checked transitively (pg_has_role), and the roles must exist (the test
    // database creates them as Supabase does), so this can't pass vacuously
    const postgrestRoles = await read.$queryRaw<
      { role: string; reaches: boolean }[]
    >`SELECT rolname AS role, pg_has_role(rolname, 'abode_app', 'MEMBER') AS reaches
      FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'authenticator')
      ORDER BY rolname`;
    expect(postgrestRoles.map((r) => r.role)).toEqual([
      "anon",
      "authenticated",
      "authenticator",
    ]);
    const exposedTo = postgrestRoles.filter((r) => r.reaches);
    expect(exposedTo).toEqual([]);
  });
});
