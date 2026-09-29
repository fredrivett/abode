import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getUser: vi.fn(),
  triggerConfigured: true,
  trigger: vi.fn(),
  reserve: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  capture: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
  getUserWithMfa: () => m.getUser(),
}));
vi.mock("@/lib/trigger/item-runs", () => ({
  isTriggerConfigured: () => m.triggerConfigured,
}));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: m.trigger } }));
vi.mock("@/lib/db", () => ({
  default: { dataExport: { findMany: m.findMany, update: m.update } },
}));
vi.mock("@/lib/export/reserve-data-export", () => ({
  reserveDataExport: m.reserve,
}));
vi.mock("@/lib/posthog-server", () => ({
  captureServerException: vi.fn(),
  getPostHogClient: () => ({ capture: m.capture }),
}));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

import { GET, POST } from "./route";

const USER = "user-1";
const createdRow = {
  id: "export-1",
  status: "pending",
  itemCount: null,
  fileCount: null,
  sizeBytes: null,
  parts: [],
  error: null,
  createdAt: new Date("2026-09-28T10:00:00.000Z"),
  completedAt: null,
  expiresAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  m.triggerConfigured = true;
  m.getUser.mockResolvedValue({ data: { user: { id: USER } } });
  m.reserve.mockResolvedValue({ status: "created", dataExport: createdRow });
  m.update.mockResolvedValue({});
  m.trigger.mockResolvedValue({ id: "run_1" });
});

describe("POST /api/v1/exports", () => {
  it("rejects a signed-out (or 2FA-pending) request", async () => {
    m.getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST()).status).toBe(401);
    expect(m.reserve).not.toHaveBeenCalled();
  });

  it("is unavailable without the background worker", async () => {
    m.triggerConfigured = false;
    expect((await POST()).status).toBe(503);
    expect(m.reserve).not.toHaveBeenCalled();
  });

  it("allows one export in progress at a time", async () => {
    m.reserve.mockResolvedValue({ status: "in_progress", exportId: "running" });
    const res = await POST();
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ exportId: "running" });
    expect(m.trigger).not.toHaveBeenCalled();
  });

  it("caps exports per day", async () => {
    m.reserve.mockResolvedValue({ status: "daily_limit" });
    expect((await POST()).status).toBe(429);
    expect(m.trigger).not.toHaveBeenCalled();
  });

  it("creates the export, enqueues the build and reports it", async () => {
    const res = await POST();

    expect(res.status).toBe(202);
    expect(m.reserve).toHaveBeenCalledWith(USER);
    expect(m.trigger).toHaveBeenCalledWith("export-user-data", {
      exportId: "export-1",
      userId: USER,
    });
    expect(m.capture).toHaveBeenCalledWith({
      distinctId: USER,
      event: "data_export_requested",
    });
    expect(await res.json()).toEqual({
      export: {
        ...createdRow,
        createdAt: "2026-09-28T10:00:00.000Z",
      },
    });
  });

  it("fails the export if it can't be enqueued, so it won't block the next one", async () => {
    m.trigger.mockRejectedValue(new Error("trigger down"));

    expect((await POST()).status).toBe(500);
    expect(m.update).toHaveBeenCalledWith({
      where: { id: "export-1" },
      data: { status: "failed", error: "Couldn't start the export" },
    });
    expect(m.capture).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/exports", () => {
  it("lists the user's recent exports", async () => {
    m.findMany.mockResolvedValue([
      {
        ...createdRow,
        status: "completed",
        sizeBytes: BigInt(2048),
        itemCount: 4,
        fileCount: 2,
        parts: [{ position: 1, sizeBytes: BigInt(2048) }],
      },
    ]);

    const res = await GET();

    expect(m.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER }, take: 5 }),
    );
    expect(await res.json()).toMatchObject({
      exports: [
        {
          id: "export-1",
          sizeBytes: 2048,
          itemCount: 4,
          fileCount: 2,
          parts: [{ position: 1, sizeBytes: 2048 }],
        },
      ],
    });
  });

  it("rejects a signed-out request", async () => {
    m.getUser.mockResolvedValue({ data: { user: null } });
    expect((await GET()).status).toBe(401);
  });
});
