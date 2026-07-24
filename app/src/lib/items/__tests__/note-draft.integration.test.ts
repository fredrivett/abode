/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import {
  clearNoteDraft,
  getNoteDraft,
  saveNoteDraft,
} from "@/lib/items/note-draft";

describe("note draft integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const createTestUser = async (email = "draft-author@example.com") => {
    const { write } = await import("@/lib/db");
    return write.user.create({
      data: { id: crypto.randomUUID(), email },
    });
  };

  test("returns null when the user has no draft", async () => {
    const user = await createTestUser();
    expect(await getNoteDraft(user.id)).toBeNull();
  });

  test("saves and reads back a draft", async () => {
    const user = await createTestUser();
    await saveNoteDraft(user.id, "# Groceries\n\nmilk");
    expect(await getNoteDraft(user.id)).toBe("# Groceries\n\nmilk");
  });

  test("upserts — a second save overwrites the first", async () => {
    const user = await createTestUser();
    await saveNoteDraft(user.id, "first");
    await saveNoteDraft(user.id, "second");
    expect(await getNoteDraft(user.id)).toBe("second");
  });

  test("saving a blank note clears any existing draft", async () => {
    const user = await createTestUser();
    await saveNoteDraft(user.id, "# Groceries\n\nmilk");
    await saveNoteDraft(user.id, "#  \n\n");
    expect(await getNoteDraft(user.id)).toBeNull();

    const { read } = await import("@/lib/db");
    expect(
      await read.noteDraft.findUnique({ where: { userId: user.id } }),
    ).toBeNull();
  });

  test("clearNoteDraft removes the draft and is a no-op when none exists", async () => {
    const user = await createTestUser();
    await clearNoteDraft(user.id); // no-op, must not throw
    await saveNoteDraft(user.id, "note body");
    await clearNoteDraft(user.id);
    expect(await getNoteDraft(user.id)).toBeNull();
  });

  test("drafts are isolated per user", async () => {
    const alice = await createTestUser("alice@example.com");
    const bob = await createTestUser("bob@example.com");
    await saveNoteDraft(alice.id, "alice's draft");
    await saveNoteDraft(bob.id, "bob's draft");
    expect(await getNoteDraft(alice.id)).toBe("alice's draft");
    expect(await getNoteDraft(bob.id)).toBe("bob's draft");
  });
});
