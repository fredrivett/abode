import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultDesign } from "./design";
import { deleteDesign, listDesigns, writeDesign } from "./design-files";

const design = (name: string) =>
  defaultDesign({ name, format: "x-header", width: 1500, height: 500 });

describe("design files", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "image-designs-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("lists nothing for a missing directory", async () => {
    expect(await listDesigns(path.join(dir, "nope"))).toEqual([]);
  });

  it("writes, lists (sorted by name) and deletes designs", async () => {
    await writeDesign({ slug: "zeta", design: design("Alpha") }, dir);
    await writeDesign({ slug: "alpha", design: design("Zeta") }, dir);
    expect((await listDesigns(dir)).map((d) => d.slug)).toEqual([
      "zeta",
      "alpha",
    ]);
    await deleteDesign("zeta", dir);
    expect((await listDesigns(dir)).map((d) => d.slug)).toEqual(["alpha"]);
  });

  it("lands concurrent writes in call order, so a stale save can't win", async () => {
    const stale = design("Stale");
    const writes = Array.from({ length: 5 }, (_, i) =>
      writeDesign(
        { slug: "race", design: i === 4 ? design("Latest") : stale },
        dir,
      ),
    );
    await Promise.all(writes);
    const saved = JSON.parse(
      await readFile(path.join(dir, "race.json"), "utf8"),
    );
    expect(saved.name).toBe("Latest");
  });

  it("skips malformed and non-design files", async () => {
    await writeDesign({ slug: "good", design: design("Good") }, dir);
    await writeFile(path.join(dir, "broken.json"), "{");
    await writeFile(path.join(dir, "notes.txt"), "hi");
    expect((await listDesigns(dir)).map((d) => d.slug)).toEqual(["good"]);
  });

  it("refuses slugs that could escape the directory", async () => {
    await expect(
      writeDesign({ slug: "../evil", design: design("Evil") }, dir),
    ).rejects.toThrow("Invalid design slug");
    await expect(deleteDesign("../evil", dir)).rejects.toThrow(
      "Invalid design slug",
    );
  });
});
