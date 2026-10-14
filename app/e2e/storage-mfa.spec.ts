import { expect, test } from "@playwright/test";
import type { Prisma } from "@prisma/client";
import { getE2EPrisma } from "./helpers/db";
import { createUserWithMfa } from "./helpers/mfa";
import { applySupabaseMigrations } from "./helpers/supabase-migrations";
import { createUser, deleteUserByEmail } from "./helpers/user";

// Storage access is decided by RLS on storage.objects, which the Storage API
// evaluates as the `authenticated` role with the caller's JWT claims — so a
// password-only (aal1) session calling it directly never meets the app's MFA
// middleware. The e2e stack runs without storage-api, so these drive the same
// policies in SQL exactly as it would: role + request.jwt.claims.

type Aal = "aal1" | "aal2";
type Session = { userId: string; aal: Aal };

const prisma = () => getE2EPrisma();

// Newer storage schemas reject DELETE on storage.objects unless this is set —
// the Storage API sets it itself, and these queries stand in for the API
async function allowDeletes(sql: Prisma.TransactionClient) {
  await sql.$executeRawUnsafe("SET LOCAL storage.allow_delete_query = 'true'");
}

/** Run `sql` as the authenticated role holding `session`'s JWT claims. */
async function asSession<T>(
  { userId, aal }: Session,
  run: (sql: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const claims = JSON.stringify({ sub: userId, role: "authenticated", aal });
  return prisma().$transaction(async (tx) => {
    await allowDeletes(tx);
    await tx.$executeRawUnsafe("SET LOCAL ROLE authenticated");
    await tx.$queryRaw`SELECT set_config('request.jwt.claims', ${claims}, true)`;
    return run(tx);
  });
}

async function seedObject({ name, userId }: { name: string; userId: string }) {
  await prisma().$executeRaw`
    INSERT INTO storage.objects (bucket_id, name, owner)
    VALUES ('items', ${name}, ${userId}::uuid)`;
}

const visibleCount = (session: Session, name: string) =>
  asSession(session, async (sql) => {
    const rows = await sql.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) FROM storage.objects
      WHERE bucket_id = 'items' AND name = ${name}`;
    return Number(rows[0].count);
  });

const insertAs = (session: Session, name: string) =>
  asSession(
    session,
    (sql) =>
      sql.$executeRaw`
      INSERT INTO storage.objects (bucket_id, name, owner)
      VALUES ('items', ${name}, ${session.userId}::uuid)`,
  );

const deleteAs = (session: Session, name: string) =>
  asSession(
    session,
    (sql) =>
      sql.$executeRaw`
        DELETE FROM storage.objects WHERE bucket_id = 'items' AND name = ${name}`,
  );

const updateAs = (session: Session, name: string) =>
  asSession(
    session,
    (sql) =>
      sql.$executeRaw`
        UPDATE storage.objects SET metadata = '{"planted":true}'::jsonb
        WHERE bucket_id = 'items' AND name = ${name}`,
  );

async function removeObjects(prefix: string) {
  await prisma().$transaction(async (tx) => {
    await allowDeletes(tx);
    await tx.$executeRaw`
      DELETE FROM storage.objects WHERE bucket_id = 'items' AND name LIKE ${`${prefix}/%`}`;
  });
}

test.describe("Storage policies enforce MFA", () => {
  // One worker, so the migrations are applied once rather than racing
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await applySupabaseMigrations();
  });

  test("an MFA user's aal1 session can't read, write or delete their files", async () => {
    const email = "storage-mfa@test.local";
    const { user } = await createUserWithMfa({
      email,
      username: "storage_mfa_user",
    });
    const key = `${user.id}/private.png`;
    const aal1: Session = { userId: user.id, aal: "aal1" };
    const aal2: Session = { userId: user.id, aal: "aal2" };

    try {
      await seedObject({ name: key, userId: user.id });

      expect(await visibleCount(aal1, key)).toBe(0);
      await expect(insertAs(aal1, `${user.id}/planted.png`)).rejects.toThrow(
        /row-level security/,
      );
      expect(await updateAs(aal1, key)).toBe(0);
      expect(await deleteAs(aal1, key)).toBe(0);
      expect(await visibleCount(aal2, key)).toBe(1);

      // Completing the challenge (aal2) restores full access
      expect(await insertAs(aal2, `${user.id}/new.png`)).toBe(1);
      expect(await updateAs(aal2, key)).toBe(1);
      expect(await deleteAs(aal2, key)).toBe(1);
    } finally {
      await removeObjects(user.id);
      await deleteUserByEmail(email);
    }
  });

  test("a user without MFA keeps full access to their own folder only", async () => {
    const email = "storage-no-mfa@test.local";
    const otherEmail = "storage-no-mfa-other@test.local";
    const user = await createUser({ email, username: "storage_no_mfa_user" });
    const other = await createUser({
      email: otherEmail,
      username: "storage_no_mfa_other",
    });
    const session: Session = { userId: user.id, aal: "aal1" };
    const othersKey = `${other.id}/theirs.png`;

    try {
      await seedObject({ name: othersKey, userId: other.id });

      expect(await insertAs(session, `${user.id}/own.png`)).toBe(1);
      expect(await visibleCount(session, `${user.id}/own.png`)).toBe(1);
      expect(await updateAs(session, `${user.id}/own.png`)).toBe(1);
      expect(await deleteAs(session, `${user.id}/own.png`)).toBe(1);

      expect(await visibleCount(session, othersKey)).toBe(0);
      await expect(
        insertAs(session, `${other.id}/planted.png`),
      ).rejects.toThrow(/row-level security/);
    } finally {
      await removeObjects(user.id);
      await removeObjects(other.id);
      await deleteUserByEmail(email);
      await deleteUserByEmail(otherEmail);
    }
  });
});
