/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import { unzipSync } from "fflate";
import { EXPORT_RETENTION_MS } from "@/lib/export/constants";
import { runDataExport } from "@/lib/export/run-data-export";

const m = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  capture: vi.fn(),
  emailConfigured: true,
}));

vi.mock("@/lib/email", () => ({
  isEmailConfigured: () => m.emailConfigured,
  sendEmail: m.sendEmail,
}));
vi.mock("@/lib/posthog-server", () => ({
  captureServerException: vi.fn(),
  getPostHogClient: () => ({ capture: m.capture }),
}));

type UploadArgs = [string, Uint8Array, { contentType: string }];

function fakeStorage(uploadError: Error | null = null) {
  const upload = vi.fn(async (..._args: UploadArgs) => ({
    data: uploadError ? null : { path: "x" },
    error: uploadError,
  }));
  const from = vi.fn(() => ({ upload }));
  return {
    supabase: { storage: { from } } as unknown as Parameters<
      typeof runDataExport
    >[0]["supabase"],
    from,
    upload,
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
  await write.item.create({
    data: {
      userId: user.id,
      kind: "note",
      title: "Hello",
      processingStatus: "completed",
      noteDetails: { create: { content: "world" } },
    },
  });
  const dataExport = await write.dataExport.create({
    data: { userId: user.id },
  });
  return { user, dataExport };
}

describe("runDataExport", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    vi.clearAllMocks();
    m.emailConfigured = true;
  });

  it("builds, uploads and completes the export, then emails the user", async () => {
    const { read } = await import("@/lib/db");
    const { user, dataExport } = await setup();
    const storage = fakeStorage();

    const result = await runDataExport({
      exportId: dataExport.id,
      supabase: storage.supabase,
    });

    expect(result).toMatchObject({ status: "completed", itemCount: 1 });
    expect(storage.from).toHaveBeenCalledWith("exports");
    const [key, bytes, options] = storage.upload.mock.calls[0];
    expect(key).toBe(`${user.id}/${dataExport.id}.zip`);
    expect(options.contentType).toBe("application/zip");
    expect(Object.keys(unzipSync(bytes))).toContain("abode.json");

    const row = await read.dataExport.findUniqueOrThrow({
      where: { id: dataExport.id },
    });
    expect(row).toMatchObject({
      status: "completed",
      fileKey: key,
      itemCount: 1,
      sizeBytes: BigInt(bytes.length),
      error: null,
    });
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
      expect.objectContaining({ event: "data_export_completed" }),
    );
  });

  it("skips the email when email isn't configured", async () => {
    const { dataExport } = await setup();
    m.emailConfigured = false;

    await runDataExport({
      exportId: dataExport.id,
      supabase: fakeStorage().supabase,
    });

    expect(m.sendEmail).not.toHaveBeenCalled();
  });

  it("still completes when the email fails to send", async () => {
    const { read } = await import("@/lib/db");
    const { dataExport } = await setup();
    m.sendEmail.mockRejectedValueOnce(new Error("smtp down"));

    await runDataExport({
      exportId: dataExport.id,
      supabase: fakeStorage().supabase,
    });

    const row = await read.dataExport.findUniqueOrThrow({
      where: { id: dataExport.id },
    });
    expect(row.status).toBe("completed");
  });

  it("is a no-op for an export that isn't pending (duplicate run)", async () => {
    const { dataExport } = await setup();
    const storage = fakeStorage();
    await runDataExport({
      exportId: dataExport.id,
      supabase: storage.supabase,
    });

    const again = await runDataExport({
      exportId: dataExport.id,
      supabase: storage.supabase,
    });

    expect(again).toEqual({ status: "skipped" });
    expect(storage.upload).toHaveBeenCalledTimes(1);
  });

  it("marks the export failed with a safe message when the upload fails", async () => {
    const { read } = await import("@/lib/db");
    const { dataExport } = await setup();

    await expect(
      runDataExport({
        exportId: dataExport.id,
        supabase: fakeStorage(new Error("bucket missing")).supabase,
      }),
    ).rejects.toThrow("bucket missing");

    const row = await read.dataExport.findUniqueOrThrow({
      where: { id: dataExport.id },
    });
    expect(row.status).toBe("failed");
    expect(row.error).toBe(
      "The export couldn't be completed. Please try again.",
    );
    expect(row.fileKey).toBeNull();
    expect(m.sendEmail).not.toHaveBeenCalled();
  });
});
