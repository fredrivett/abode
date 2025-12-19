/// <reference types="vitest/globals" />
import { resetTestDatabase } from "@app/vitest.setup.db";

describe("Username Integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe("Case-insensitive uniqueness", () => {
    it("prevents creating users with same username different case", async () => {
      const { write } = await import("@/lib/db");

      // Create first user with username
      await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440100",
          email: "user1@example.com",
          username: "Fred",
        },
      });

      // Attempt to create second user with same username different case
      await expect(
        write.user.create({
          data: {
            id: "550e8400-e29b-41d4-a716-446655440101",
            email: "user2@example.com",
            username: "fred",
          },
        }),
      ).rejects.toThrow();

      await expect(
        write.user.create({
          data: {
            id: "550e8400-e29b-41d4-a716-446655440102",
            email: "user3@example.com",
            username: "FRED",
          },
        }),
      ).rejects.toThrow();
    });

    it("allows different usernames", async () => {
      const { write } = await import("@/lib/db");

      await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440103",
          email: "user1@example.com",
          username: "fred",
        },
      });

      const user2 = await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440104",
          email: "user2@example.com",
          username: "john",
        },
      });

      expect(user2.username).toBe("john");
    });
  });

  describe("Previous username tracking", () => {
    it("stores previous usernames when changed", async () => {
      const { write } = await import("@/lib/db");

      // Create user with initial username
      const user = await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440105",
          email: "test@example.com",
          username: "original",
          previousUsernames: [],
        },
      });

      // Simulate username change
      const updatedUser = await write.user.update({
        where: { id: user.id },
        data: {
          username: "newname",
          previousUsernames: [
            {
              username: "original",
              changedAt: new Date().toISOString(),
            },
          ],
        },
      });

      expect(updatedUser.username).toBe("newname");
      const prevUsernames = updatedUser.previousUsernames as Array<{
        username: string;
        changedAt: string;
      }>;
      expect(prevUsernames).toHaveLength(1);
      expect(prevUsernames[0].username).toBe("original");
    });

    it("accumulates multiple username changes", async () => {
      const { write } = await import("@/lib/db");

      const user = await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440106",
          email: "multi@example.com",
          username: "first",
          previousUsernames: [],
        },
      });

      // First change
      await write.user.update({
        where: { id: user.id },
        data: {
          username: "second",
          previousUsernames: [
            { username: "first", changedAt: "2024-01-01T00:00:00Z" },
          ],
        },
      });

      // Second change
      const finalUser = await write.user.update({
        where: { id: user.id },
        data: {
          username: "third",
          previousUsernames: [
            { username: "first", changedAt: "2024-01-01T00:00:00Z" },
            { username: "second", changedAt: "2024-01-02T00:00:00Z" },
          ],
        },
      });

      expect(finalUser.username).toBe("third");
      const prevUsernames = finalUser.previousUsernames as Array<{
        username: string;
        changedAt: string;
      }>;
      expect(prevUsernames).toHaveLength(2);
    });
  });

  describe("Username availability", () => {
    it("finds user by username case-insensitively", async () => {
      const { write, read } = await import("@/lib/db");

      await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440107",
          email: "findme@example.com",
          username: "FindMe",
        },
      });

      // Should find with different cases
      const found1 = await read.user.findFirst({
        where: {
          username: {
            equals: "findme",
            mode: "insensitive",
          },
        },
      });
      expect(found1).not.toBeNull();
      expect(found1?.username).toBe("FindMe");

      const found2 = await read.user.findFirst({
        where: {
          username: {
            equals: "FINDME",
            mode: "insensitive",
          },
        },
      });
      expect(found2).not.toBeNull();
    });

    it("returns null for non-existent username", async () => {
      const { read } = await import("@/lib/db");

      const notFound = await read.user.findFirst({
        where: {
          username: {
            equals: "doesnotexist",
            mode: "insensitive",
          },
        },
      });

      expect(notFound).toBeNull();
    });
  });

  describe("Released usernames", () => {
    it("allows taking a previously used username after release", async () => {
      const { write } = await import("@/lib/db");

      // User 1 takes username, then changes it
      const user1 = await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440108",
          email: "user1@example.com",
          username: "coolname",
          previousUsernames: [],
        },
      });

      await write.user.update({
        where: { id: user1.id },
        data: {
          username: "newname",
          previousUsernames: [
            { username: "coolname", changedAt: new Date().toISOString() },
          ],
        },
      });

      // User 2 should be able to take the released username
      const user2 = await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440109",
          email: "user2@example.com",
          username: "coolname",
        },
      });

      expect(user2.username).toBe("coolname");
    });
  });
});
