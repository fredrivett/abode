/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import { recordViewer, runInViewerFrame } from "@/lib/viewer-context";

/**
 * The default `db` client picks its connection from the request's viewer
 * frame: with RLS_ENFORCED on, a frame runs every query as the restricted
 * abode_app role for its viewer (anonymous until recorded); outside a frame,
 * or with the flag off, it's the owner connection as before.
 */
describe("contextual db client", () => {
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    await resetTestDatabase();
    const { systemDb } = await import("@/lib/db");
    alice = crypto.randomUUID();
    bob = crypto.randomUUID();
    for (const [id, name] of [
      [alice, "alice"],
      [bob, "bob"],
    ]) {
      await systemDb.user.create({
        data: { id, email: `${name}@example.com`, username: name },
      });
      await systemDb.item.create({
        data: { userId: id, kind: "note", sourceType: "compose", title: name },
      });
    }
  });

  afterEach(() => vi.unstubAllEnvs());

  const asViewer = <T>(viewerId: string | null, run: () => Promise<T>) =>
    runInViewerFrame(async () => {
      if (viewerId) recordViewer(viewerId);
      return run();
    });

  const titles = async () => {
    const { default: db } = await import("@/lib/db");
    const items = await db.item.findMany({ orderBy: { title: "asc" } });
    return items.map((item) => item.title);
  };

  describe("with RLS_ENFORCED off", () => {
    it("is the owner connection even inside a frame", async () => {
      expect(await asViewer(alice, titles)).toEqual(["alice", "bob"]);
    });
  });

  describe("with RLS_ENFORCED on", () => {
    beforeEach(() => vi.stubEnv("RLS_ENFORCED", "true"));

    it("restricts a frame to its viewer's rows", async () => {
      expect(await asViewer(alice, titles)).toEqual(["alice"]);
      expect(await asViewer(bob, titles)).toEqual(["bob"]);
    });

    it("shows a frame that never authenticated nothing", async () => {
      expect(await asViewer(null, titles)).toEqual([]);
    });

    it("leaves code outside any frame on the owner connection", async () => {
      expect(await titles()).toEqual(["alice", "bob"]);
    });

    it("restricts the read client too", async () => {
      const { read } = await import("@/lib/db");
      const count = await asViewer(alice, () => read.item.count());
      expect(count).toBe(1);
    });

    it("runs interactive transactions as the viewer", async () => {
      const { default: db } = await import("@/lib/db");
      const seen = await asViewer(alice, () =>
        db.$transaction(async (tx) => {
          const items = await tx.item.findMany();
          return items.map((item) => item.title);
        }),
      );
      expect(seen).toEqual(["alice"]);
    });

    it("passes transaction options through", async () => {
      const { default: db } = await import("@/lib/db");
      const level = await asViewer(alice, () =>
        db.$transaction(
          async (tx) => {
            const [row] = await tx.$queryRaw<{ level: string }[]>`
              SELECT current_setting('transaction_isolation') AS level`;
            return row.level;
          },
          { isolationLevel: "Serializable" },
        ),
      );
      expect(level).toBe("serializable");
    });

    it("refuses batch transactions rather than running them unrestricted", async () => {
      const { default: db } = await import("@/lib/db");
      await expect(
        asViewer(alice, async () => db.$transaction([db.item.count()])),
      ).rejects.toThrow(/Batch \$transaction/);
    });

    it("keeps systemDb on the owner connection inside a frame", async () => {
      const { systemDb } = await import("@/lib/db");
      expect(await asViewer(alice, () => systemDb.item.count())).toBe(2);
    });

    it("keeps concurrent frames apart", async () => {
      expect(
        await Promise.all([asViewer(alice, titles), asViewer(bob, titles)]),
      ).toEqual([["alice"], ["bob"]]);
    });
  });
});
