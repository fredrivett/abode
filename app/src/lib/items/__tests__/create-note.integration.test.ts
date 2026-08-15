/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import { createNote } from "@/lib/items/create-note";

describe("createNote integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const createTestUser = async (email = "note-author@example.com") => {
    const { write } = await import("@/lib/db");
    return write.user.create({
      data: { id: crypto.randomUUID(), email },
    });
  };

  const readBack = async (itemId: string) => {
    const { read } = await import("@/lib/db");
    return read.item.findUniqueOrThrow({
      where: { id: itemId },
      select: {
        title: true,
        kind: true,
        captureSource: true,
        noteDetails: { select: { content: true } },
      },
    });
  };

  test("lifts a leading heading into the persisted title and strips the body", async () => {
    const user = await createTestUser();

    const created = await createNote(user.id, {
      content: "# Reading list\n\nBooks to get through this quarter:",
      source: "web",
    });

    expect(created.kind).toBe("note");
    expect(created.title).toBe("Reading list");
    expect(created.noteDetails?.content).toBe(
      "Books to get through this quarter:",
    );

    // Persisted, not just returned
    const stored = await readBack(created.id);
    expect(stored.title).toBe("Reading list");
    expect(stored.noteDetails?.content).toBe(
      "Books to get through this quarter:",
    );
  });

  test("leaves a non-heading note untitled with its body intact", async () => {
    const user = await createTestUser();

    const created = await createNote(user.id, {
      content: "Just a quick thought\nand a second line",
      source: "web",
    });

    expect(created.title).toBeNull();
    expect(created.noteDetails?.content).toBe(
      "Just a quick thought\nand a second line",
    );
  });

  test("does not treat a leading list item as a title", async () => {
    const user = await createTestUser();

    const created = await createNote(user.id, {
      content: "* milk\n* eggs",
      source: "web",
    });

    expect(created.title).toBeNull();
    expect(created.noteDetails?.content).toBe("* milk\n* eggs");
  });

  test("an explicit title wins and leaves the body untouched", async () => {
    const user = await createTestUser();

    const created = await createNote(user.id, {
      title: "Manual title",
      content: "# A heading in the body\n\nbody",
      source: "web",
    });

    expect(created.title).toBe("Manual title");
    expect(created.noteDetails?.content).toBe(
      "# A heading in the body\n\nbody",
    );
  });

  test("handles empty content", async () => {
    const user = await createTestUser();

    const created = await createNote(user.id, { content: "", source: "web" });

    expect(created.title).toBeNull();
    expect(created.noteDetails?.content).toBe("");
  });

  test("persists the capture source (e.g. extension) it was given", async () => {
    const user = await createTestUser();

    const created = await createNote(user.id, {
      content: "Saved from a page selection",
      source: "extension",
    });

    expect(created.captureSource).toBe("extension");

    const stored = await readBack(created.id);
    expect(stored.captureSource).toBe("extension");
  });
});
