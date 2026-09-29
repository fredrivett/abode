import { readFileSync } from "node:fs";
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

  const writer = (maxPartBytes: number) =>
    new PartedArchiveWriter({
      dir,
      modifiedAt: new Date("2026-09-29T00:00:00.000Z"),
      maxPartBytes,
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

  it("writes a single part when everything fits", async () => {
    const archive = writer(10 * KB * KB);
    archive.addFile("README.md", "# hi");
    const json = archive.openFile("abode.json");
    json.write('{"items":[');
    json.write("]}");
    json.end();
    await archive.addBinary("files/a/original.jpg", bytes(KB));

    const parts = await archive.finish();

    expect(parts.map(({ position }) => position)).toEqual([1]);
    expect(handed).toHaveLength(1);
    const { files } = handed[0];
    expect(strFromU8(files["README.md"])).toBe("# hi");
    expect(strFromU8(files["abode.json"])).toBe('{"items":[]}');
    expect(files["files/a/original.jpg"]).toEqual(bytes(KB));
    expect(parts[0].sizeBytes).toBe(readFileSync(parts[0].path).length);
  });

  it("rolls into a new part before a file would overflow the limit", async () => {
    const archive = writer(100 * KB);
    archive.addFile("README.md", "data");
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

  it("puts a file bigger than the limit in a part of its own", async () => {
    const archive = writer(10 * KB);
    await archive.addBinary("files/a/small.jpg", bytes(KB));
    await archive.addBinary("files/b/huge.jpg", bytes(50 * KB));

    expect((await archive.finish()).map(({ position }) => position)).toEqual([
      1, 2,
    ]);
    expect(Object.keys(handed[1].files)).toEqual(["files/b/huge.jpg"]);
  });

  it("never splits a part while a streamed file is still open", async () => {
    const archive = writer(10 * KB);
    const json = archive.openFile("abode.json");
    json.write("[");
    await archive.addBinary("files/a/1.jpg", bytes(20 * KB));
    json.write("]");
    json.end();

    await archive.finish();

    expect(handed).toHaveLength(1);
    expect(strFromU8(handed[0].files["abode.json"])).toBe("[]");
  });

  it("refuses to finish with a streamed file still open", async () => {
    const archive = writer(KB);
    archive.openFile("abode.json");
    await expect(archive.finish()).rejects.toThrow(/never ended/);
  });
});
