import { strToU8, Zip, ZipDeflate } from "fflate";

// Text compresses well; 6 is zlib's default speed/size balance
const DEFLATE_LEVEL = 6;

/**
 * An in-progress ZIP archive. Files can be added whole, or opened as a stream
 * and written incrementally (e.g. `abode.json`, one item at a time) while other
 * files are added — fflate buffers later entries until the stream ends.
 * Output is collected in memory, which suits data-only exports; a files export
 * would need to stream to disk/storage instead.
 */
export class ArchiveWriter {
  private readonly zip: Zip;
  private readonly chunks: Uint8Array[] = [];
  private finished = false;
  private error: Error | null = null;

  constructor(private readonly modifiedAt: Date) {
    this.zip = new Zip((error, chunk, final) => {
      if (error) {
        this.error = error;
        return;
      }
      this.chunks.push(chunk);
      if (final) this.finished = true;
    });
  }

  private entry(path: string): ZipDeflate {
    const file = new ZipDeflate(path, { level: DEFLATE_LEVEL });
    file.mtime = this.modifiedAt;
    this.zip.add(file);
    return file;
  }

  addFile(path: string, content: string): void {
    this.entry(path).push(strToU8(content), true);
  }

  openFile(path: string): { write: (text: string) => void; end: () => void } {
    const file = this.entry(path);
    return {
      write: (text) => file.push(strToU8(text)),
      end: () => file.push(new Uint8Array(0), true),
    };
  }

  /** Closes the archive and returns its bytes. Every opened file must be ended first. */
  finish(): Uint8Array {
    this.zip.end();
    if (this.error) throw this.error;
    if (!this.finished) {
      throw new Error("Archive incomplete: a streamed file was never ended");
    }
    const size = this.chunks.reduce((total, chunk) => total + chunk.length, 0);
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of this.chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  }
}
