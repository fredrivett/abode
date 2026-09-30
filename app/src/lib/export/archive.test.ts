import { readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type ArchivePart, PartedArchiveWriter } from "./archive";

const KB = 1024;
const bytes = (size: number, fill = 1) => new Uint8Array(size).fill(fill);

describe("PartedArchiveWriter", () => {
  let dir: string;
  let handed: { part: ArchivePart; files: Record<string, Uint8Array> }[];

  const writer = (maxPartBytes: number, maxEntriesPerPart?: number) =>
    new PartedArchiveWriter({
      dir,
      modifiedAt: new Date("2026-09-29T00:00:00.000Z"),
      maxPartBytes,
      maxEntriesPerPart,
      // Read each part as it's handed over, as the uploader would
      onPart: async (part) => {
        handed.push({ part, files: unzipSync(readFileSync(part.path)) });
      },
    });

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "archive-test-"));
    handed = [];
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes text, text from disk and binary files into a single part when they fit", async () => {
    const onDisk = join(dir, "abode.json");
    writeFileSync(onDisk, '{"items":[]}');
    const archive = writer(10 * KB * KB);
    await archive.addText("README.md", "# hi");
    await archive.addTextFromDisk("abode.json", onDisk);
    await archive.addBinary("files/a/original.jpg", bytes(KB));

    const parts = await archive.finish();

    expect(parts.map(({ position }) => position)).toEqual([1]);
    const { files } = handed[0];
    expect(strFromU8(files["README.md"])).toBe("# hi");
    expect(strFromU8(files["abode.json"])).toBe('{"items":[]}');
    expect(files["files/a/original.jpg"]).toEqual(bytes(KB));
    expect(parts[0].sizeBytes).toBe(readFileSync(parts[0].path).length);
  });

  it("rolls into a new part before a file would overflow the limit", async () => {
    const archive = writer(100 * KB);
    await archive.addText("README.md", "data");
    await archive.addBinary("files/a/1.jpg", bytes(60 * KB, 1));
    await archive.addBinary("files/b/2.jpg", bytes(60 * KB, 2));
    await archive.addBinary("files/c/3.jpg", bytes(30 * KB, 3));

    const parts = await archive.finish();

    expect(parts.map(({ position }) => position)).toEqual([1, 2]);
    expect(Object.keys(handed[0].files).sort()).toEqual([
      "README.md",
      "files/a/1.jpg",
    ]);
    expect(Object.keys(handed[1].files).sort()).toEqual([
      "files/b/2.jpg",
      "files/c/3.jpg",
    ]);
    expect(handed[1].files["files/b/2.jpg"]).toEqual(bytes(60 * KB, 2));
  });

  it("keeps every finished part within the limit, headers and directory included", async () => {
    const limit = 20 * KB;
    const archive = writer(limit);
    // Many entries with long names: the zip metadata is a real share of each part
    for (let i = 0; i < 40; i++) {
      await archive.addBinary(
        `files/${"x".repeat(120)}-${i}/original.jpg`,
        bytes(1500, i),
      );
    }

    const parts = await archive.finish();

    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(part.sizeBytes).toBeLessThanOrEqual(limit);
    }
    const all = Object.assign({}, ...handed.map(({ files }) => files));
    expect(Object.keys(all)).toHaveLength(40);
  });

  it("starts a new part at the entry cap, for text as well as files", async () => {
    const archive = writer(10 * KB * KB, 3);
    for (let i = 0; i < 7; i++) {
      await archive.addText(`items/note/${i}.md`, `# ${i}`);
    }

    const parts = await archive.finish();

    expect(handed.map(({ files }) => Object.keys(files).length)).toEqual([
      3, 3, 1,
    ]);
    expect(parts).toHaveLength(3);
  });

  it("fails clearly when a single entry can't fit in any part", async () => {
    const archive = writer(10 * KB);
    await archive.addBinary("files/a/small.jpg", bytes(KB));
    await archive.addBinary("files/b/huge.jpg", bytes(50 * KB));

    await expect(archive.finish()).rejects.toThrow(
      /over the 10240-byte part limit/,
    );
  });

  it("surfaces a disk error as a rejection, not an unhandled error", async () => {
    const archive = new PartedArchiveWriter({
      dir: join(dir, "missing", "folder"),
      modifiedAt: new Date(),
      maxPartBytes: KB * KB,
      onPart: async () => {},
    });
    await archive.addText("README.md", "hi").catch(() => {});

    await expect(archive.finish()).rejects.toThrow(/ENOENT/);
  });
});
