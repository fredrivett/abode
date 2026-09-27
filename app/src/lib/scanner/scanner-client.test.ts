import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ScannerClient } from "./scanner-client";

// jsdom has no ImageData; the client only reads its pixel buffer
class FakeImageData {
  data: Uint8ClampedArray;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}
beforeAll(() => vi.stubGlobal("ImageData", FakeImageData));
afterAll(() => vi.unstubAllGlobals());

/** Stands in for the worker: records requests, lets tests post replies */
class FakeWorker extends EventTarget {
  posted: { message: { id: number; type: string }; transfer: unknown[] }[] = [];
  terminate = vi.fn();

  postMessage(message: { id: number; type: string }, transfer: unknown[]) {
    this.posted.push({ message, transfer });
  }

  reply(data: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }

  crash(message: string) {
    this.dispatchEvent(new ErrorEvent("error", { message }));
  }
}

function setup() {
  const worker = new FakeWorker();
  const client = new ScannerClient(worker);
  return { worker, client };
}

const lastId = (worker: FakeWorker) => worker.posted.at(-1)?.message.id;

describe("ScannerClient", () => {
  it("resolves init with the detector the worker loaded", async () => {
    const { worker, client } = setup();
    const ready = client.init();
    worker.reply({ id: lastId(worker), type: "init", detector: "ml" });
    await expect(ready).resolves.toBe("ml");
  });

  it("matches out-of-order responses to their requests by id", async () => {
    const { worker, client } = setup();
    const frame = new ImageData(2, 2);
    const first = client.detect(frame);
    const firstId = lastId(worker);
    const second = client.detect(new ImageData(2, 2));
    const secondId = lastId(worker);

    worker.reply({
      id: secondId,
      type: "detect",
      detection: { quad: null, score: 0.1 },
    });
    worker.reply({
      id: firstId,
      type: "detect",
      detection: { quad: null, score: 0.9 },
    });

    await expect(first).resolves.toEqual({ quad: null, score: 0.9 });
    await expect(second).resolves.toEqual({ quad: null, score: 0.1 });
  });

  it("transfers detection frames instead of copying them", () => {
    const { worker, client } = setup();
    const frame = new ImageData(2, 2);
    void client.detect(frame);
    expect(worker.posted[0].transfer).toEqual([frame.data.buffer]);
  });

  it("rejects when the worker reports an error", async () => {
    const { worker, client } = setup();
    const rendering = client.render({
      source: new Blob(),
      quad: null,
      rotation: 0,
      filter: "bw",
    });
    worker.reply({ id: lastId(worker), type: "error", message: "bad image" });
    await expect(rendering).rejects.toThrow("bad image");
  });

  it("rejects a response of the wrong type", async () => {
    const { worker, client } = setup();
    const ready = client.init();
    worker.reply({
      id: lastId(worker),
      type: "render",
      blob: new Blob(),
      width: 1,
      height: 1,
    });
    await expect(ready).rejects.toThrow(/Expected init/);
  });

  it("ignores malformed messages", async () => {
    const { worker, client } = setup();
    const ready = client.init();
    worker.reply({ id: lastId(worker), type: "init", detector: "gpu" });
    worker.reply({ id: lastId(worker), type: "init", detector: "classical" });
    await expect(ready).resolves.toBe("classical");
  });

  it("fails everything in flight when the worker crashes", async () => {
    const { worker, client } = setup();
    const ready = client.init();
    worker.crash("out of memory");
    await expect(ready).rejects.toThrow("out of memory");
  });

  it("fails everything in flight and stops the worker on terminate", async () => {
    const { worker, client } = setup();
    const ready = client.init();
    client.terminate();
    await expect(ready).rejects.toThrow("Scanner closed");
    expect(worker.terminate).toHaveBeenCalled();
  });
});
