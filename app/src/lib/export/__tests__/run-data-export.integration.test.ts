/// <reference types="vitest/globals" />

import type { Readable } from "node:stream";
import { resetTestDatabase } from "@app/vitest.setup.db";
import { unzipSync } from "fflate";
import { EXPORT_RETENTION_MS } from "@/lib/export/constants";
import { runDataExport } from "@/lib/export/run-data-export";

const m = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  capture: vi.fn(),
  captureServerException: vi.fn(),
  emailConfigured: true,
}));

vi.mock("@/lib/email", () => ({
  isEmailConfigured: () => m.emailConfigured,
  sendEmail: m.sendEmail,
}));
vi.mock("@/lib/posthog-server", () => ({
  captureServerException: m.captureServerException,
  getPostHogClient: () => ({ capture: m.capture }),
}));

async function readStream(stream: Readable): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return new Uint8Array(Buffer.concat(chunks));
}

/**
 * In-memory storage: `stored` holds library files (`bucket:key`), uploads land
 * in `uploads` (read from the stream runDataExport hands over), and `failUploadAt`
 * makes the Nth upload fail.
 */
function fakeStorage({
  stored = {},
  failUploadAt,
  onUpload,
}: {
  stored?: Record<string, Uint8Array<ArrayBuffer>>;
  failUploadAt?: number;
  onUpload?: () => Promise<unknown>;
} = {}) {
  const uploads = new Map<string, Uint8Array>();
  const removed: string[] = [];
  let uploadCount = 0;
  const from = vi.fn((bucket: string) => ({
    download: async (key: string) => {
      if (key.endsWith("/throws.jpg")) throw new Error("socket hang up");
      const data = stored[`${bucket}:${key}`];
      return data
        ? { data: new Blob([data]), error: null }
        : { data: null, error: new Error("Object not found") };
    },
    upload: async (key: string, body: Readable) => {
      uploadCount += 1;
      if (uploadCount === failUploadAt) {
        return { data: null, error: new Error("Payload too large") };
      }
      uploads.set(key, await readStream(body));
      await onUpload?.();
      return { data: { path: key }, error: null };
    },
    remove: async (keys: string[]) => {
      removed.push(...keys);
      return { data: [], error: null };
    },
  }));
  return {
    supabase: { storage: { from } } as unknown as Parameters<
      typeof runDataExport
    >[0]["supabase"],
    uploads,
    removed,
  };
}

async function setup() {
  const { write } = await import("@/lib/db");
  const user = await write.user.create({
    data: {
      id: crypto.randomUUID(),
      email: `run-${crypto.randomUUID()}@example.com`,
    },
  });
  const photo = await write.item.create({
    data: {
      userId: user.id,
      kind: "image",
      title: "Photo",
      processingStatus: "completed",
      fileKey: `${user.id}/photo.jpg`,
    },
  });
  const dataExport = await write.dataExport.create({
    data: { userId: user.id },
  });
  const stored = {
    [`items:${user.id}/photo.jpg`]: new Uint8Array(64 * 1024).fill(5),
  };
  return { user, photo, dataExport, stored };
}

describe("runDataExport", () => {
  const originalPartMb = process.env.DATA_EXPORT_PART_MB;

  beforeEach(async () => {
    await resetTestDatabase();
    vi.clearAllMocks();
    m.emailConfigured = true;
  });
  afterEach(() => {
    if (originalPartMb === undefined) delete process.env.DATA_EXPORT_PART_MB;
    else process.env.DATA_EXPORT_PART_MB = originalPartMb;
  });

  it("builds, uploads and completes the export with its files, then emails the user", async () => {
    const { read } = await import("@/lib/db");
    const { user, photo, dataExport, stored } = await setup();
    const storage = fakeStorage({ stored });

    const result = await runDataExport({
      exportId: dataExport.id,
      supabase: storage.supabase,
    });

    expect(result).toMatchObject({
      status: "completed",
      itemCount: 1,
      fileCount: 1,
      missingFileCount: 0,
      partCount: 1,
    });
    const key = `${user.id}/${dataExport.id}/part-1.zip`;
    const archive = unzipSync(storage.uploads.get(key) ?? new Uint8Array());
    const folder = `abode-export-${new Date().toISOString().slice(0, 10)}`;
    expect(Object.keys(archive)).toEqual(
      expect.arrayContaining([
        `${folder}/abode.json`,
        `${folder}/files/${photo.id}/original.jpg`,
      ]),
    );

    const row = await read.dataExport.findUniqueOrThrow({
      where: { id: dataExport.id },
      include: { parts: true },
    });
    expect(row).toMatchObject({
      status: "completed",
      itemCount: 1,
      fileCount: 1,
      error: null,
    });
    expect(row.parts).toEqual([
      expect.objectContaining({
        position: 1,
        fileKey: key,
        sizeBytes: BigInt(storage.uploads.get(key)?.length ?? -1),
      }),
    ]);
    expect(row.sizeBytes).toBe(row.parts[0].sizeBytes);
    expect(row.expiresAt?.getTime()).toBe(
      (row.completedAt?.getTime() ?? 0) + EXPORT_RETENTION_MS,
    );

    expect(m.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: user.email,
        subject: "your abode export is ready",
      }),
    );
    expect(m.capture).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "data_export_completed",
        properties: expect.objectContaining({ file_count: 1, part_count: 1 }),
      }),
    );
  });

  it("splits into several parts at DATA_EXPORT_PART_MB", async () => {
    const { read } = await import("@/lib/db");
    const { user, dataExport, stored } = await setup();
    const { write } = await import("@/lib/db");
    await write.item.create({
      data: {
        userId: user.id,
        kind: "image",
        processingStatus: "completed",
        fileKey: `${user.id}/second.jpg`,
      },
    });
    stored[`items:${user.id}/second.jpg`] = new Uint8Array(64 * 1024).fill(6);
    // ~100 KB parts: each 64 KB photo needs a part of its own
    process.env.DATA_EXPORT_PART_MB = String(100 / 1024);
    const storage = fakeStorage({ stored });

    const result = await runDataExport({
      exportId: dataExport.id,
      supabase: storage.supabase,
    });

    expect(result).toMatchObject({ status: "completed", partCount: 2 });
    const parts = await read.dataExportPart.findMany({
      where: { exportId: dataExport.id },
      orderBy: { position: "asc" },
    });
    expect(parts.map(({ fileKey }) => fileKey)).toEqual([
      `${user.id}/${dataExport.id}/part-1.zip`,
      `${user.id}/${dataExport.id}/part-2.zip`,
    ]);
  });

  it("treats a download that throws as a missing file, not a failed export", async () => {
    const { write } = await import("@/lib/db");
    const { user, dataExport, stored } = await setup();
    await write.item.create({
      data: {
        userId: user.id,
        kind: "image",
        processingStatus: "completed",
        fileKey: `${user.id}/throws.jpg`,
      },
    });

    const result = await runDataExport({
      exportId: dataExport.id,
      supabase: fakeStorage({ stored }).supabase,
    });

    expect(result).toMatchObject({
      status: "completed",
      fileCount: 1,
      missingFileCount: 1,
    });
  });

  it("skips the email when email isn't configured", async () => {
    const { dataExport, stored } = await setup();
    m.emailConfigured = false;

    await runDataExport({
      exportId: dataExport.id,
      supabase: fakeStorage({ stored }).supabase,
    });

    expect(m.sendEmail).not.toHaveBeenCalled();
  });

  it.each([
    ["throws", () => m.sendEmail.mockRejectedValueOnce(new Error("smtp down"))],
    [
      "reports failure",
      () =>
        m.sendEmail.mockResolvedValueOnce({
          success: false,
          error: "rejected",
        }),
    ],
  ])(
    "still completes, and reports it, when the email %s",
    async (_label, fail) => {
      const { read } = await import("@/lib/db");
      const { user, dataExport, stored } = await setup();
      fail();

      await runDataExport({
        exportId: dataExport.id,
        supabase: fakeStorage({ stored }).supabase,
      });

      const row = await read.dataExport.findUniqueOrThrow({
        where: { id: dataExport.id },
      });
      expect(row.status).toBe("completed");
      expect(m.captureServerException).toHaveBeenCalledWith(
        expect.any(Error),
        user.id,
        { context: "data_export_email" },
      );
    },
  );

  it("deletes uploaded parts if the run can't be marked completed", async () => {
    const { write } = await import("@/lib/db");
    const { user, dataExport, stored } = await setup();
    const storage = fakeStorage({
      stored,
      // Deleting the row mid-run makes the completion write fail
      onUpload: () => write.dataExport.delete({ where: { id: dataExport.id } }),
    });

    await expect(
      runDataExport({ exportId: dataExport.id, supabase: storage.supabase }),
    ).rejects.toThrow();

    expect(storage.removed).toEqual([`${user.id}/${dataExport.id}/part-1.zip`]);
  });

  it("is a no-op for an export that isn't pending (duplicate run)", async () => {
    const { dataExport, stored } = await setup();
    const storage = fakeStorage({ stored });
    await runDataExport({
      exportId: dataExport.id,
      supabase: storage.supabase,
    });

    const again = await runDataExport({
      exportId: dataExport.id,
      supabase: storage.supabase,
    });

    expect(again).toEqual({ status: "skipped" });
    expect(storage.uploads.size).toBe(1);
  });

  it("fails cleanly when a part won't upload, deleting parts already stored", async () => {
    const { read, write } = await import("@/lib/db");
    const { user, dataExport, stored } = await setup();
    await write.item.create({
      data: {
        userId: user.id,
        kind: "image",
        processingStatus: "completed",
        fileKey: `${user.id}/second.jpg`,
      },
    });
    stored[`items:${user.id}/second.jpg`] = new Uint8Array(64 * 1024).fill(6);
    process.env.DATA_EXPORT_PART_MB = String(100 / 1024);
    const storage = fakeStorage({ stored, failUploadAt: 2 });

    await expect(
      runDataExport({ exportId: dataExport.id, supabase: storage.supabase }),
    ).rejects.toThrow("Payload too large");

    expect(storage.removed).toEqual([`${user.id}/${dataExport.id}/part-1.zip`]);
    const row = await read.dataExport.findUniqueOrThrow({
      where: { id: dataExport.id },
      include: { parts: true },
    });
    expect(row.status).toBe("failed");
    expect(row.error).toBe(
      "The export couldn't be completed. Please try again.",
    );
    expect(row.parts).toEqual([]);
    expect(m.sendEmail).not.toHaveBeenCalled();
  });
});
