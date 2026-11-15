/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import { reserveItemImport } from "@/lib/imports/reserve-item-import";

async function createUser() {
  const { write } = await import("@/lib/db");
  return write.user.create({
    data: {
      id: crypto.randomUUID(),
      email: `reserve-import-${crypto.randomUUID()}@example.com`,
    },
  });
}

describe("reserveItemImport", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("creates only one import when requests race", async () => {
    const { read } = await import("@/lib/db");
    const user = await createUser();

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        reserveItemImport({
          userId: user.id,
          source: "literal",
          totalCount: 3,
        }),
      ),
    );

    expect(results.filter((r) => r.status === "created")).toHaveLength(1);
    expect(results.filter((r) => r.status === "in_progress")).toHaveLength(5);
    expect(await read.itemImport.count({ where: { userId: user.id } })).toBe(1);
  });

  it("starts a new import once the previous one has finished", async () => {
    const { write, read } = await import("@/lib/db");
    const user = await createUser();
    await write.itemImport.createMany({
      data: [
        { userId: user.id, source: "literal", status: "completed" },
        { userId: user.id, source: "literal", status: "failed" },
      ],
    });

    const result = await reserveItemImport({
      userId: user.id,
      source: "literal",
      totalCount: 2,
    });

    expect(result.status).toBe("created");
    expect(
      await read.itemImport.findUniqueOrThrow({
        where: { id: result.importId },
      }),
    ).toMatchObject({ status: "importing", totalCount: 2, completedAt: null });
  });

  it("records an empty library as already completed", async () => {
    const { read } = await import("@/lib/db");
    const user = await createUser();

    const result = await reserveItemImport({
      userId: user.id,
      source: "literal",
      totalCount: 0,
    });

    const row = await read.itemImport.findUniqueOrThrow({
      where: { id: result.importId },
    });
    expect(row.status).toBe("completed");
    expect(row.completedAt).not.toBeNull();
  });
});
