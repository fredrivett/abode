/// <reference types="vitest/globals" />
import { resetTestDatabase } from "@app/vitest.setup.db";

describe("Database Integration", () => {
  // Reset the database before each test to ensure isolation
  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe("User operations", () => {
    it("can create a user", async () => {
      const { write } = await import("@/lib/db");

      const user = await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
        },
      });

      expect(user.email).toBe("test@example.com");
      expect(user.firstName).toBe("Test");
      expect(user.lastName).toBe("User");
    });

    it("can query users", async () => {
      const { write, read } = await import("@/lib/db");

      // Create a user
      await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440001",
          email: "query-test@example.com",
        },
      });

      // Query using read client
      const users = await read.user.findMany({
        where: { email: "query-test@example.com" },
      });

      expect(users).toHaveLength(1);
      expect(users[0].email).toBe("query-test@example.com");
    });

    it("enforces unique email constraint", async () => {
      const { write } = await import("@/lib/db");

      await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440002",
          email: "duplicate@example.com",
        },
      });

      await expect(
        write.user.create({
          data: {
            id: "550e8400-e29b-41d4-a716-446655440003",
            email: "duplicate@example.com",
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe("Item operations", () => {
    it("can create an item for a user", async () => {
      const { write } = await import("@/lib/db");

      // Create user first
      const user = await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440004",
          email: "item-test@example.com",
        },
      });

      // Create item
      const item = await write.item.create({
        data: {
          userId: user.id,
          kind: "image",
          sourceType: "upload",
          title: "Test Image",
          tags: ["test", "example"],
        },
      });

      expect(item.title).toBe("Test Image");
      expect(item.kind).toBe("image");
      expect(item.tags).toEqual(["test", "example"]);
      expect(item.processingStatus).toBe("pending");
    });

    it("creates items with user relationship", async () => {
      const { write } = await import("@/lib/db");

      // Create user and item
      const user = await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440005",
          email: "relationship-test@example.com",
        },
      });

      await write.item.create({
        data: {
          userId: user.id,
          kind: "article",
          sourceType: "upload",
          title: "Test Article",
        },
      });

      // Verify item exists and is linked to user
      const items = await write.item.findMany({
        where: { userId: user.id },
        include: { user: true },
      });
      expect(items).toHaveLength(1);
      expect(items[0].user.email).toBe("relationship-test@example.com");
    });

    it("cascades delete from user to items", async () => {
      const { write } = await import("@/lib/db");

      // Create user and item
      const user = await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440006",
          email: "cascade-test@example.com",
        },
      });

      const item = await write.item.create({
        data: {
          userId: user.id,
          kind: "article",
          sourceType: "upload",
          title: "Test Article",
        },
      });

      // Verify item exists
      const itemsBefore = await write.item.findMany({
        where: { id: item.id },
      });
      expect(itemsBefore).toHaveLength(1);

      // Delete user - should cascade to items
      await write.user.delete({
        where: { id: user.id },
      });

      // Verify item was deleted via cascade
      const itemsAfter = await write.item.findMany({
        where: { id: item.id },
      });
      expect(itemsAfter).toHaveLength(0);
    });

    it("can query items by processing status", async () => {
      const { write, read } = await import("@/lib/db");

      const user = await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440007",
          email: "status-test@example.com",
        },
      });

      // Create items with different processing statuses
      const processingItem = await write.item.create({
        data: {
          userId: user.id,
          kind: "image",
          sourceType: "upload",
          title: "Processing Image",
          processingStatus: "processing",
        },
      });

      const completedItem = await write.item.create({
        data: {
          userId: user.id,
          kind: "image",
          sourceType: "upload",
          title: "Completed Image",
          processingStatus: "completed",
        },
      });

      const failedItem = await write.item.create({
        data: {
          userId: user.id,
          kind: "image",
          sourceType: "upload",
          title: "Failed Image",
          processingStatus: "failed",
        },
      });

      // Query status for specific items (simulates the /api/v1/items/status endpoint)
      const ids = [processingItem.id, completedItem.id, failedItem.id];
      const items = await read.item.findMany({
        where: {
          id: { in: ids },
          userId: user.id,
        },
        select: {
          id: true,
          processingStatus: true,
        },
      });

      expect(items).toHaveLength(3);

      const statusMap = new Map(items.map((i) => [i.id, i.processingStatus]));
      expect(statusMap.get(processingItem.id)).toBe("processing");
      expect(statusMap.get(completedItem.id)).toBe("completed");
      expect(statusMap.get(failedItem.id)).toBe("failed");
    });

    it("only returns items belonging to the requesting user", async () => {
      const { write, read } = await import("@/lib/db");

      const user1 = await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440008",
          email: "user1-isolation@example.com",
        },
      });

      const user2 = await write.user.create({
        data: {
          id: "550e8400-e29b-41d4-a716-446655440009",
          email: "user2-isolation@example.com",
        },
      });

      const user1Item = await write.item.create({
        data: {
          userId: user1.id,
          kind: "image",
          sourceType: "upload",
          title: "User 1 Image",
          processingStatus: "processing",
        },
      });

      const user2Item = await write.item.create({
        data: {
          userId: user2.id,
          kind: "image",
          sourceType: "upload",
          title: "User 2 Image",
          processingStatus: "processing",
        },
      });

      // User 1 tries to query both items - should only get their own
      const ids = [user1Item.id, user2Item.id];
      const items = await read.item.findMany({
        where: {
          id: { in: ids },
          userId: user1.id,
        },
        select: {
          id: true,
          processingStatus: true,
        },
      });

      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(user1Item.id);
    });
  });
});
