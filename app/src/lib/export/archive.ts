import { once } from "node:events";
import { createReadStream, createWriteStream, type WriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { strToU8, Zip, ZipDeflate, ZipPassThrough } from "fflate";

// Text compresses well; 6 is zlib's default speed/size balance
const DEFLATE_LEVEL = 6;

// zip32 (all fflate writes) caps an archive at 65,535 entries; roll well before
export const MAX_ENTRIES_PER_PART = 60_000;

// zip32 record sizes, to keep a part's *finished* size under the limit: each
// entry costs a local header (+ data descriptor) where it's written and a
// central-directory record at the end, both carrying the filename
const LOCAL_HEADER_BYTES = 30 + 16;
const CENTRAL_RECORD_BYTES = 46;
const END_RECORD_BYTES = 22;

// Deflate can slightly expand incompressible input; budget for the worst case
const deflatedBound = (rawBytes: number) =>
  rawBytes + Math.ceil(rawBytes / 1000) + 64;

export type ArchivePart = {
  /** 1-based part number */
  position: number;
  /** Where the finished part sits on local disk */
  path: string;
  sizeBytes: number;
};

type CurrentPart = {
  position: number;
  path: string;
  zip: Zip;
  out: WriteStream;
  /** Bytes written so far */
  bytes: number;
  /** Central-directory bytes still to be written when the part closes */
  centralBytes: number;
  entries: number;
  done: Promise<void>;
};

/**
 * A ZIP archive written to disk as one or more parts. Text is deflated;
 * binary files (images, PDFs — already compressed) are stored as-is. Before a
 * file would take the finished part past `maxPartBytes` (headers and central
 * directory included) or past `maxEntriesPerPart`, the part is closed and
 * handed to `onPart` (e.g. to upload and delete it), so only one part ever
 * sits on disk. Each add waits for the disk to drain, so memory stays flat.
 */
export class PartedArchiveWriter {
  private current: CurrentPart;
  private readonly parts: ArchivePart[] = [];
  private error: Error | null = null;
  private readonly maxEntriesPerPart: number;

  constructor(
    private readonly options: {
      dir: string;
      modifiedAt: Date;
      maxPartBytes: number;
      maxEntriesPerPart?: number;
      /** Top-level folder for each part's entries (none if omitted) */
      folderForPart?: (position: number) => string;
      onPart: (part: ArchivePart) => Promise<void>;
    },
  ) {
    this.maxEntriesPerPart = options.maxEntriesPerPart ?? MAX_ENTRIES_PER_PART;
    this.current = this.startPart(1);
  }

  private startPart(position: number): CurrentPart {
    const path = join(this.options.dir, `part-${position}.zip`);
    const out = createWriteStream(path);
    const done = new Promise<void>((resolve, reject) => {
      out.once("finish", () => resolve());
      out.once("error", reject);
    });
    // A disk error fails the next add (via `drained`) or the part's close
    out.on("error", (error) => {
      this.error ??= error;
    });
    done.catch(() => {});
    const part: CurrentPart = {
      position,
      path,
      out,
      bytes: 0,
      centralBytes: 0,
      entries: 0,
      done,
      zip: new Zip((error, chunk, final) => {
        if (error) {
          this.error = error;
          return;
        }
        part.bytes += chunk.length;
        out.write(chunk);
        if (final) out.end();
      }),
    };
    return part;
  }

  private async closeCurrent(): Promise<void> {
    const { zip, done, position, path } = this.current;
    zip.end();
    await done;
    if (this.error) throw this.error;
    const part = { position, path, sizeBytes: this.current.bytes };
    // Only a single entry bigger than the limit can get here
    if (part.sizeBytes > this.options.maxPartBytes) {
      throw new Error(
        `Export part ${position} is ${part.sizeBytes} bytes, over the ${this.options.maxPartBytes}-byte part limit`,
      );
    }
    this.parts.push(part);
    await this.options.onPart(part);
  }

  /** An entry's full path inside the current part */
  private entryPath(path: string): string {
    const folder = this.options.folderForPart?.(this.current.position);
    return folder ? `${folder}/${path}` : path;
  }

  /**
   * Starts a new part first if an entry of up to `maxBytes` wouldn't fit, and
   * returns the entry's full path in whichever part it lands in
   */
  private async makeRoom(path: string, maxBytes: number): Promise<string> {
    const nameBytes = strToU8(this.entryPath(path)).length;
    const { bytes, centralBytes, entries } = this.current;
    const finishedSize =
      bytes +
      centralBytes +
      END_RECORD_BYTES +
      LOCAL_HEADER_BYTES +
      CENTRAL_RECORD_BYTES +
      2 * nameBytes +
      maxBytes;
    const full =
      finishedSize > this.options.maxPartBytes ||
      entries >= this.maxEntriesPerPart;
    if (full && entries > 0) {
      await this.closeCurrent();
      this.current = this.startPart(this.current.position + 1);
    }
    const fullPath = this.entryPath(path);
    this.current.entries += 1;
    this.current.centralBytes +=
      CENTRAL_RECORD_BYTES + strToU8(fullPath).length;
    return fullPath;
  }

  private add<T extends ZipDeflate | ZipPassThrough>(file: T): T {
    file.mtime = this.options.modifiedAt;
    this.current.zip.add(file);
    return file;
  }

  // Let the disk catch up rather than queueing a library's worth in memory
  private async drained(): Promise<void> {
    if (this.error) throw this.error;
    if (this.current.out.writableNeedDrain) {
      await Promise.race([once(this.current.out, "drain"), this.current.done]);
    }
    if (this.error) throw this.error;
  }

  /** Adds a text file (deflated) */
  async addText(path: string, content: string): Promise<void> {
    const data = strToU8(content);
    const fullPath = await this.makeRoom(path, deflatedBound(data.length));
    this.add(new ZipDeflate(fullPath, { level: DEFLATE_LEVEL })).push(
      data,
      true,
    );
    await this.drained();
  }

  /** Adds a text file from local disk (deflated), streaming it in chunks */
  async addTextFromDisk(path: string, diskPath: string): Promise<void> {
    const { size } = await stat(diskPath);
    const fullPath = await this.makeRoom(path, deflatedBound(size));
    const file = this.add(new ZipDeflate(fullPath, { level: DEFLATE_LEVEL }));
    for await (const chunk of createReadStream(diskPath)) {
      file.push(chunk);
      await this.drained();
    }
    file.push(new Uint8Array(0), true);
    await this.drained();
  }

  /** Adds a binary file (stored, not compressed) */
  async addBinary(path: string, data: Uint8Array): Promise<void> {
    const fullPath = await this.makeRoom(path, data.length);
    this.add(new ZipPassThrough(fullPath)).push(data, true);
    await this.drained();
  }

  /** Closes the last part and returns every part, in order */
  async finish(): Promise<ArchivePart[]> {
    await this.closeCurrent();
    return this.parts;
  }
}
