import type { ScanFilter } from "./filters";
import type { Quad } from "./geometry";
import {
  type Detection,
  type Detector,
  isScannerResponseMessage,
  type ScannerRequest,
  type ScannerResponse,
} from "./protocol";
import type { Rotation } from "./warp";

interface Pending {
  resolve: (response: ScannerResponse) => void;
  reject: (error: Error) => void;
}

export interface RenderedPage {
  blob: Blob;
  width: number;
  height: number;
}

/** The slice of `Worker` the client uses (lets tests supply a fake) */
export interface WorkerLike extends EventTarget {
  postMessage(message: unknown, transfer: Transferable[]): void;
  terminate(): void;
}

function unexpected(expected: string, response: ScannerResponse): Error {
  return new Error(`Expected ${expected} response, got ${response.type}`);
}

/**
 * Promise-based wrapper around the scanner worker. Each request gets an id;
 * the worker echoes it back so responses can arrive out of order.
 */
export class ScannerClient {
  private nextId = 0;
  private readonly pending = new Map<number, Pending>();

  constructor(private readonly worker: WorkerLike) {
    worker.addEventListener("message", (event) => {
      if (!(event instanceof MessageEvent)) return;
      const message: unknown = event.data;
      if (!isScannerResponseMessage(message)) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.type === "error") {
        pending.reject(new Error(message.message));
      } else {
        pending.resolve(message);
      }
    });
    worker.addEventListener("error", (event) => {
      const detail = event instanceof ErrorEvent ? event.message : "";
      this.failAll(new Error(detail || "Scanner worker crashed"));
    });
  }

  static create(): ScannerClient {
    return new ScannerClient(
      new Worker(new URL("./scanner.worker.ts", import.meta.url), {
        type: "module",
      }),
    );
  }

  /** Loads scanic + the ML model; resolves with the detector in use */
  async init(): Promise<Detector> {
    const response = await this.send({ type: "init" });
    if (response.type !== "init") throw unexpected("init", response);
    return response.detector;
  }

  /** Detects a document in a (small) live frame. Transfers the frame's buffer. */
  async detect(frame: ImageData): Promise<Detection> {
    const response = await this.send({ type: "detect", frame }, [
      frame.data.buffer,
    ]);
    if (response.type !== "detect") throw unexpected("detect", response);
    return response.detection;
  }

  /** Encodes a full-resolution frame and finds its page corners */
  async capture({
    frame,
    hint,
  }: {
    frame: ImageData;
    hint: Quad | null;
  }): Promise<{ source: Blob; quad: Quad | null }> {
    const response = await this.send({ type: "capture", frame, hint }, [
      frame.data.buffer,
    ]);
    if (response.type !== "capture") throw unexpected("capture", response);
    return { source: response.source, quad: response.quad };
  }

  /** Flattens, rotates and filters a captured photo into a page image */
  async render(page: {
    source: Blob;
    quad: Quad | null;
    rotation: Rotation;
    filter: ScanFilter;
  }): Promise<RenderedPage> {
    const response = await this.send({ type: "render", ...page });
    if (response.type !== "render") throw unexpected("render", response);
    return {
      blob: response.blob,
      width: response.width,
      height: response.height,
    };
  }

  terminate() {
    this.worker.terminate();
    this.failAll(new Error("Scanner closed"));
  }

  private send(
    request: ScannerRequest,
    transfer: Transferable[] = [],
  ): Promise<ScannerResponse> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.worker.postMessage({ ...request, id }, transfer);
      } catch (error) {
        // e.g. an already-transferred (detached) buffer — don't leak the entry
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private failAll(error: Error) {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}
