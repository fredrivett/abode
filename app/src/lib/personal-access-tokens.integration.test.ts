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
        scopes: ["read"],
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

    it("persists the chosen scopes", async () => {
      const { write } = await import("@/lib/db");
      const { createPersonalAccessToken } = await import(
        "@/lib/personal-access-tokens"
      );

      const { summary } = await createPersonalAccessToken(USER_A, {
        name: "Shortcut",
        expiresInDays: null,
        scopes: ["write"],
      });

      expect(summary.scopes).toEqual(["write"]);
      expect(summary.itemCount).toBe(0);
      const row = await write.personalAccessToken.findUnique({
        where: { id: summary.id },
      });
      expect(row?.scopes).toEqual(["write"]);
    });

    it("sets an expiry roughly expiresInDays out when provided", async () => {
      const { createPersonalAccessToken } = await import(
        "@/lib/personal-access-tokens"
      );

      const { summary } = await createPersonalAccessToken(USER_A, {
        name: "Expiring",
        expiresInDays: 30,
        scopes: ["read"],
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
        scopes: ["read"],
      });
      const second = await createPersonalAccessToken(USER_A, {
        name: "second",
        expiresInDays: null,
        scopes: ["read"],
      });
      await revokePersonalAccessToken(first.summary.id, USER_A);

      const list = await listPersonalAccessTokens(USER_A);
      expect(list.map((t) => t.id)).toEqual([second.summary.id]);
    });

    it("counts the items each token saved", async () => {
      const { write } = await import("@/lib/db");
      const { createPersonalAccessToken, listPersonalAccessTokens } =
        await import("@/lib/personal-access-tokens");

      const saver = await createPersonalAccessToken(USER_A, {
        name: "saver",
        expiresInDays: null,
        scopes: ["write"],
      });
      await createPersonalAccessToken(USER_A, {
        name: "reader",
        expiresInDays: null,
        scopes: ["read"],
      });
      for (const title of ["one", "two"]) {
        await write.item.create({
          data: {
            userId: USER_A,
            title,
            captureSource: "api",
            personalAccessTokenId: saver.summary.id,
          },
        });
      }
      // A session save isn't attributed to any token
      await write.item.create({
        data: { userId: USER_A, title: "web", captureSource: "web" },
      });

      const list = await listPersonalAccessTokens(USER_A);
      const counts = Object.fromEntries(list.map((t) => [t.name, t.itemCount]));
      expect(counts).toEqual({ saver: 2, reader: 0 });
    });

    it("is scoped to the owner", async () => {
      const { createPersonalAccessToken, listPersonalAccessTokens } =
        await import("@/lib/personal-access-tokens");

      await createPersonalAccessToken(USER_B, {
        name: "b's token",
        expiresInDays: null,
        scopes: ["read"],
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
        scopes: ["read"],
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
        scopes: ["read"],
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

      // A malformed (non-uuid) id is not-found, never a DB error
      const malformed = await revokePersonalAccessToken("not-a-uuid", USER_A);
      expect(malformed).toEqual({
        success: false,
        error: "Token not found",
        code: "NOT_FOUND",
      });

      const { summary } = await createPersonalAccessToken(USER_A, {
        name: "once",
        expiresInDays: null,
        scopes: ["read"],
      });
      await revokePersonalAccessToken(summary.id, USER_A);
      const again = await revokePersonalAccessToken(summary.id, USER_A);
      expect(again.success).toBe(false);
    });
  });

  describe("listTokenSavedItems", () => {
    async function saveWith(tokenId: string, title: string, addedAt: Date) {
      const { write } = await import("@/lib/db");
      return write.item.create({
        data: {
          userId: USER_A,
          title,
          captureSource: "api",
          personalAccessTokenId: tokenId,
          addedAt,
        },
        select: { id: true },
      });
    }

    it("lists only that token's items, newest first, a page at a time", async () => {
      const { write } = await import("@/lib/db");
      const { createPersonalAccessToken, listTokenSavedItems } = await import(
        "@/lib/personal-access-tokens"
      );
      const { decodeCursor } = await import("@/lib/pagination");

      const saver = await createPersonalAccessToken(USER_A, {
        name: "saver",
        expiresInDays: null,
        scopes: ["write"],
      });
      const other = await createPersonalAccessToken(USER_A, {
        name: "other",
        expiresInDays: null,
        scopes: ["write"],
      });
      const day = 24 * 60 * 60 * 1000;
      for (const [i, title] of ["oldest", "middle", "newest"].entries()) {
        await saveWith(
          saver.summary.id,
          title,
          new Date(Date.now() - (3 - i) * day),
        );
      }
      await saveWith(other.summary.id, "other token's", new Date());
      await write.item.create({ data: { userId: USER_A, title: "web save" } });

      const first = await listTokenSavedItems({
        userId: USER_A,
        tokenId: saver.summary.id,
        cursor: null,
        limit: 2,
      });
      expect(first?.items.map((i) => i.title)).toEqual(["newest", "middle"]);
      expect(first?.nextCursor).not.toBeNull();

      const second = await listTokenSavedItems({
        userId: USER_A,
        tokenId: saver.summary.id,
        cursor: decodeCursor(first?.nextCursor ?? ""),
        limit: 2,
      });
      expect(second?.items.map((i) => i.title)).toEqual(["oldest"]);
      expect(second?.nextCursor).toBeNull();
    });

    it("still lists a revoked token's items", async () => {
      const {
        createPersonalAccessToken,
        revokePersonalAccessToken,
        listTokenSavedItems,
      } = await import("@/lib/personal-access-tokens");

      const { summary } = await createPersonalAccessToken(USER_A, {
        name: "leaked",
        expiresInDays: null,
        scopes: ["write"],
      });
      await saveWith(summary.id, "added by the leak", new Date());
      await revokePersonalAccessToken(summary.id, USER_A);

      const page = await listTokenSavedItems({
        userId: USER_A,
        tokenId: summary.id,
        cursor: null,
        limit: 25,
      });
      expect(page?.items.map((i) => i.title)).toEqual(["added by the leak"]);
    });

    it("returns null for another user's token or a malformed id", async () => {
      const { createPersonalAccessToken, listTokenSavedItems } = await import(
        "@/lib/personal-access-tokens"
      );

      const { summary } = await createPersonalAccessToken(USER_B, {
        name: "b's token",
        expiresInDays: null,
        scopes: ["write"],
      });

      expect(
        await listTokenSavedItems({
          userId: USER_A,
          tokenId: summary.id,
          cursor: null,
          limit: 25,
        }),
      ).toBeNull();
      expect(
        await listTokenSavedItems({
          userId: USER_A,
          tokenId: "not-a-uuid",
          cursor: null,
          limit: 25,
        }),
      ).toBeNull();
    });
  });
});
