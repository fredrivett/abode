import { once } from "node:events";
import { createWriteStream, type WriteStream } from "node:fs";
import { join } from "node:path";
import { strToU8, Zip, ZipDeflate, ZipPassThrough } from "fflate";

// Text compresses well; 6 is zlib's default speed/size balance
const DEFLATE_LEVEL = 6;

// zip32 (all fflate writes) caps an archive at 65,535 entries; roll well before
const MAX_ENTRIES_PER_PART = 60_000;

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
  bytes: number;
  entries: number;
  done: Promise<void>;
};

/**
 * A ZIP archive written to disk as one or more parts. Text files are deflated;
 * binary files (images and PDFs, already compressed) are stored as-is. Before
 * a binary file would push the current part past `maxPartBytes` (or zip32's
 * entry limit), the part is closed and handed to `onPart` — e.g. to upload and
 * delete it — so only one part ever sits on disk. Parts only roll between
 * binary files, never while a streamed file (`openFile`) is still open.
 */
export class PartedArchiveWriter {
  private current: CurrentPart;
  private readonly parts: ArchivePart[] = [];
  private openStreams = 0;
  private error: Error | null = null;

  constructor(
    private readonly options: {
      dir: string;
      modifiedAt: Date;
      maxPartBytes: number;
      onPart: (part: ArchivePart) => Promise<void>;
    },
  ) {
    this.current = this.startPart(1);
  }

  private startPart(position: number): CurrentPart {
    const path = join(this.options.dir, `part-${position}.zip`);
    const out = createWriteStream(path);
    const done = new Promise<void>((resolve, reject) => {
      out.once("finish", () => resolve());
      out.once("error", reject);
    });
    const part: CurrentPart = {
      position,
      path,
      out,
      bytes: 0,
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

  private entry<T extends ZipDeflate | ZipPassThrough>(file: T): T {
    file.mtime = this.options.modifiedAt;
    this.current.zip.add(file);
    this.current.entries += 1;
    return file;
  }

  private async closeCurrent(): Promise<void> {
    const { zip, done, position, path } = this.current;
    zip.end();
    await done;
    if (this.error) throw this.error;
    const part = { position, path, sizeBytes: this.current.bytes };
    this.parts.push(part);
    await this.options.onPart(part);
  }

  /** Adds a whole text file (deflated) */
  addFile(path: string, content: string): void {
    this.entry(new ZipDeflate(path, { level: DEFLATE_LEVEL })).push(
      strToU8(content),
      true,
    );
  }

  /** Opens a text file (deflated) to write incrementally; end it before finishing */
  openFile(path: string): { write: (text: string) => void; end: () => void } {
    const file = this.entry(new ZipDeflate(path, { level: DEFLATE_LEVEL }));
    this.openStreams += 1;
    return {
      write: (text) => file.push(strToU8(text)),
      end: () => {
        file.push(new Uint8Array(0), true);
        this.openStreams -= 1;
      },
    };
  }

  /** Adds a binary file (stored), starting a new part first if it won't fit */
  async addBinary(path: string, data: Uint8Array): Promise<void> {
    const { bytes, entries } = this.current;
    const full =
      bytes + data.length > this.options.maxPartBytes ||
      entries >= MAX_ENTRIES_PER_PART;
    if (full && entries > 0 && this.openStreams === 0) {
      await this.closeCurrent();
      this.current = this.startPart(this.current.position + 1);
    }

    this.entry(new ZipPassThrough(path)).push(data, true);
    if (this.error) throw this.error;
    // Let the disk catch up rather than queueing a library's worth in memory
    if (this.current.out.writableNeedDrain)
      await once(this.current.out, "drain");
  }

  /** Closes the last part and returns every part, in order */
  async finish(): Promise<ArchivePart[]> {
    if (this.openStreams > 0) {
      throw new Error("Archive incomplete: a streamed file was never ended");
    }
    await this.closeCurrent();
    return this.parts;
  }
}
