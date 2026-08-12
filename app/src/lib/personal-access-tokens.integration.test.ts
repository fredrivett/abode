/// <reference types="vitest/globals" />
import { resetTestDatabase } from "@app/vitest.setup.db";

const USER_A = "550e8400-e29b-41d4-a716-4466554400a1";
const USER_B = "550e8400-e29b-41d4-a716-4466554400b2";

async function seedUser(id: string, email: string) {
  const { write } = await import("@/lib/db");
  await write.user.create({ data: { id, email } });
}

describe("Personal access tokens integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    await seedUser(USER_A, "a@example.com");
    await seedUser(USER_B, "b@example.com");
  });

  describe("createPersonalAccessToken", () => {
    it("returns a raw abode_pat_ token but persists only its hash", async () => {
      const { write } = await import("@/lib/db");
      const { createPersonalAccessToken } = await import(
        "@/lib/personal-access-tokens"
      );
      const { hashPersonalAccessToken } = await import(
        "@/lib/auth/personal-access-token"
      );

      const { token, summary } = await createPersonalAccessToken(USER_A, {
        name: "Claude Desktop",
        expiresInDays: null,
      });

      expect(token.startsWith("abode_pat_")).toBe(true);
      expect(summary.name).toBe("Claude Desktop");
      expect(summary.expiresAt).toBeNull();

      const row = await write.personalAccessToken.findUnique({
        where: { id: summary.id },
      });
      expect(row?.tokenHash).toBe(hashPersonalAccessToken(token));
      // The raw token is never stored
      expect(row?.tokenHash).not.toContain(token);
      expect(summary.tokenPrefix.startsWith("abode_pat_")).toBe(true);
    });

    it("sets an expiry roughly expiresInDays out when provided", async () => {
      const { createPersonalAccessToken } = await import(
        "@/lib/personal-access-tokens"
      );

      const { summary } = await createPersonalAccessToken(USER_A, {
        name: "Expiring",
        expiresInDays: 30,
      });

      expect(summary.expiresAt).not.toBeNull();
      const daysOut =
        (new Date(summary.expiresAt as string).getTime() - Date.now()) /
        (24 * 60 * 60 * 1000);
      expect(daysOut).toBeGreaterThan(29.9);
      expect(daysOut).toBeLessThan(30.1);
    });
  });

  describe("listPersonalAccessTokens", () => {
    it("lists a user's active tokens newest first and excludes revoked ones", async () => {
      const {
        createPersonalAccessToken,
        revokePersonalAccessToken,
        listPersonalAccessTokens,
      } = await import("@/lib/personal-access-tokens");

      const first = await createPersonalAccessToken(USER_A, {
        name: "first",
        expiresInDays: null,
      });
      const second = await createPersonalAccessToken(USER_A, {
        name: "second",
        expiresInDays: null,
      });
      await revokePersonalAccessToken(first.summary.id, USER_A);

      const list = await listPersonalAccessTokens(USER_A);
      expect(list.map((t) => t.id)).toEqual([second.summary.id]);
    });

    it("is scoped to the owner", async () => {
      const { createPersonalAccessToken, listPersonalAccessTokens } =
        await import("@/lib/personal-access-tokens");

      await createPersonalAccessToken(USER_B, {
        name: "b's token",
        expiresInDays: null,
      });

      const list = await listPersonalAccessTokens(USER_A);
      expect(list).toEqual([]);
    });
  });

  describe("revokePersonalAccessToken", () => {
    it("soft-revokes the token and drops it from the list", async () => {
      const { write } = await import("@/lib/db");
      const { createPersonalAccessToken, revokePersonalAccessToken } =
        await import("@/lib/personal-access-tokens");

      const { summary } = await createPersonalAccessToken(USER_A, {
        name: "to revoke",
        expiresInDays: null,
      });

      const result = await revokePersonalAccessToken(summary.id, USER_A);
      expect(result.success).toBe(true);

      const row = await write.personalAccessToken.findUnique({
        where: { id: summary.id },
      });
      expect(row?.revokedAt).not.toBeNull();
    });

    it("will not revoke another user's token and reports not found", async () => {
      const { write } = await import("@/lib/db");
      const { createPersonalAccessToken, revokePersonalAccessToken } =
        await import("@/lib/personal-access-tokens");

      const { summary } = await createPersonalAccessToken(USER_B, {
        name: "b's token",
        expiresInDays: null,
      });

      const result = await revokePersonalAccessToken(summary.id, USER_A);
      expect(result).toEqual({
        success: false,
        error: "Token not found",
        code: "NOT_FOUND",
      });

      // B's token is untouched
      const row = await write.personalAccessToken.findUnique({
        where: { id: summary.id },
      });
      expect(row?.revokedAt).toBeNull();
    });

    it("reports not found for an unknown or already-revoked token", async () => {
      const { createPersonalAccessToken, revokePersonalAccessToken } =
        await import("@/lib/personal-access-tokens");

      const unknown = await revokePersonalAccessToken(
        "00000000-0000-0000-0000-000000000000",
        USER_A,
      );
      expect(unknown.success).toBe(false);

      const { summary } = await createPersonalAccessToken(USER_A, {
        name: "once",
        expiresInDays: null,
      });
      await revokePersonalAccessToken(summary.id, USER_A);
      const again = await revokePersonalAccessToken(summary.id, USER_A);
      expect(again.success).toBe(false);
    });
  });
});
